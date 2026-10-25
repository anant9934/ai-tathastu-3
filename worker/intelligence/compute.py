"""`compute_intelligence` handler.

Reads the user's usable facts (confirmed/edited, plus API-sourced facts that
weren't rejected), then in one transaction rewrites:
  skill_evidence     one row per (skill, fact)
  unified_projects   CV projects matched to GitHub repos
  eris_scores        one row per target role
  profile_views      the precomputed dashboard document

Recomputing is idempotent: each run replaces the user's previous output.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import psycopg2.extras

from db import enqueue_compute_matches, fetch_all, fetch_one, jsonb
from intelligence import eris, projects, skills, widgets
from intelligence.collaboration import process_collaboration_embedding
from intelligence.config import persona_intents
from intelligence.repo_scorer import score_and_save_user_repos
from intelligence.roadmap import generate_career_roadmap, generate_next_best_actions, save_roadmap
from intelligence.skill_graph import SkillGraph, generate_skill_gaps_and_recommendations
from jobs import Job
from resume.deterministic import _PATTERNS

log = logging.getLogger("worker.intelligence")

API_ORIGINS = ("github", "kaggle", "stack_exchange", "portfolio", "leetcode", "hackerrank", "linkedin_scrape")
VIEW_VERSION = 1


def lexicon_scan(text: str) -> List[str]:
    """Canonical skills named in free text (unambiguous patterns only)."""
    return sorted({canonical for canonical, pattern, section_only in _PATTERNS if not section_only and pattern.search(text)})


def process_compute_intelligence(conn: Any, job: Job) -> None:
    user_id = job.user_id
    now = datetime.now(timezone.utc)
    with conn, conn.cursor() as cur:
        skills.seed(cur)
        user = fetch_one(
            cur,
            """SELECT name, university, degree, role::text AS role, department, academic_title, company, job_title,
                      graduation_year FROM users WHERE id = %s""",
            (user_id,),
        )
        state = fetch_one(
            cur,
            """SELECT career_role, career_role_other, career_roles, priorities, research_interests, expertise_areas,
                      mentorship, give_back FROM onboarding_state WHERE user_id = %s""",
            (user_id,),
        )
        if not user or not state:
            log.info("user %s has no profile/onboarding state; nothing to compute", user_id)
            return
        facts = fetch_all(
            cur,
            """SELECT id, field_group, field_name, record_key, normalized_value, extracted_value, origin, confirmation
                 FROM profile_facts
                WHERE user_id = %s AND superseded_by IS NULL
                  AND (confirmation IN ('confirmed', 'edited')
                       OR (origin = ANY(%s) AND confirmation <> 'rejected'))""",
            (user_id, list(API_ORIGINS)),
        )
        repos = fetch_all(
            cur,
            "SELECT id, repo_name, url, languages, topics, stars, last_commit_at FROM code_repositories WHERE user_id = %s",
            (user_id,),
        )
        connections = fetch_all(cur, "SELECT source_id, status, last_sync_at FROM connections WHERE user_id = %s", (user_id,))

        # ── Skill graph ─────────────────────────────────────────────────────
        index = skills.SkillIndex(cur)
        repo_count: Dict[str, int] = {}
        for r in repos:
            for lang in (r["languages"] or {}):
                repo_count[lang] = repo_count.get(lang, 0) + 1
        evidence = skills.collect(facts, index, repo_count, lexicon_scan)
        cur.execute("DELETE FROM skill_evidence WHERE user_id = %s", (user_id,))
        if evidence:
            psycopg2.extras.execute_values(
                cur,
                "INSERT INTO skill_evidence (user_id, skill_id, fact_id, source, evidence_strength) VALUES %s",
                [(user_id, e.skill_id, e.fact_id, e.source, e.strength) for e in evidence],
            )
        categories = {r["id"]: r["category"] for r in fetch_all(cur, "SELECT id, category FROM skills")}
        readiness = skills.readiness(evidence)
        readiness_by_name = {index.names[sid]: v for sid, v in readiness.items()}
        skill_summary = skills.summarize(evidence, index.names, categories)

        # ── Unified projects ────────────────────────────────────────────────
        def canonical(mention: str) -> Optional[str]:
            sid = index.resolve(mention)
            return index.names.get(sid) if sid else None

        unified = projects.unify(projects.records_from(facts, repos, canonical))
        cur.execute("DELETE FROM unified_projects WHERE user_id = %s", (user_id,))
        if unified:
            psycopg2.extras.execute_values(
                cur,
                """INSERT INTO unified_projects
                     (user_id, canonical_title, source_fact_ids, match_confidence, technologies, status, timeline_end)
                   VALUES %s""",
                [
                    (user_id, u.canonical_title, u.fact_ids, u.match_confidence, u.technologies, u.status,
                     u.timeline_end.date() if u.timeline_end else None)
                    for u in unified
                ],
                template="(%s, %s, %s::uuid[], %s, %s::text[], %s, %s)",
            )

        # ── ERIS ────────────────────────────────────────────────────────────
        roles = list(state["career_roles"] or ([state["career_role"]] if state["career_role"] else []))
        project_techs = [u.technologies for u in unified]
        eris_by_role: Dict[str, Dict[str, Any]] = {}
        problem_solving = eris.problem_solving_score(facts)
        for role in roles:
            result = eris.score_role(role, readiness_by_name, project_techs, problem_solving)
            if result:
                eris_by_role[role] = result
        cur.execute("DELETE FROM eris_scores WHERE user_id = %s", (user_id,))
        for role, result in eris_by_role.items():
            cur.execute(
                "INSERT INTO eris_scores (user_id, role, score, breakdown_json, computed_at) VALUES (%s, %s, %s, %s, %s)",
                (user_id, role, result["score"], jsonb(result["breakdown"]), now),
            )
        primary_eris = next((eris_by_role[r] for r in roles if r in eris_by_role), None)
        primary_role_with_eris = next((r for r in roles if r in eris_by_role), None)

        # ── Widgets ─────────────────────────────────────────────────────────
        persona = user["role"] or "student"
        github = next((c for c in connections if c["source_id"] == "github"), None)
        connected = {c["source_id"] for c in connections}
        resume_done = any(f["origin"] == "resume" for f in facts)
        if persona == "faculty":
            checks = [
                {"id": "faculty_profile", "label": "Add your department and title", "done": bool(user["department"] and user["academic_title"])},
                {"id": "research", "label": "Add research interests", "done": bool(state["research_interests"])},
                {"id": "orcid", "label": "Connect ORCID", "done": "orcid" in connected},
                {"id": "mentorship", "label": "Set your mentoring capacity", "done": "capacity" in (state["mentorship"] or {})},
                {"id": "resume", "label": "Add your CV", "done": resume_done},
            ]
        elif persona == "alumni":
            checks = [
                {"id": "alumni_profile", "label": "Add your degree and class year", "done": bool(user["degree"] and user["graduation_year"])},
                {"id": "work", "label": "Add your current role", "done": bool(user["company"] and user["job_title"])},
                {"id": "linkedin", "label": "Connect LinkedIn", "done": "linkedin" in connected},
                {"id": "give_back", "label": "Choose how to give back", "done": any((state["give_back"] or {}).values())},
                {"id": "resume", "label": "Add your resume", "done": resume_done},
            ]
        else:
            checks = [
                {"id": "basic_profile", "label": "Add your university and degree", "done": bool(user["university"] and user["degree"])},
                {"id": "resume", "label": "Review your resume fields", "done": resume_done},
                {"id": "github", "label": "Connect GitHub", "done": github is not None},
                {"id": "skills", "label": "Have 3 or more evidenced skills", "done": len(skill_summary) >= 3},
                {"id": "projects", "label": "Have a project on record", "done": bool(unified)},
            ]
        completeness = round(sum(c["done"] for c in checks) / len(checks), 2)
        gaps = primary_eris["breakdown"]["gaps"] if primary_eris else []
        recent = sorted((r for r in repos if r["last_commit_at"]), key=lambda r: r["last_commit_at"], reverse=True)[:5]
        widget_list = widgets.score_widgets(
            priorities=persona_intents(persona, state),
            role=roles[0] if roles else None,
            persona=persona,
            groups_with_data={f["field_group"] for f in facts},
            last_sync={c["source_id"]: c["last_sync_at"] for c in connections},
            eligible={
                "eris_readiness": primary_eris is not None,
                "job_matches": len(skill_summary) >= 3,
                "skill_gaps": bool(gaps),
                "github_activity": github is not None,
                "profile_completeness": completeness < 1,
            },
            data={
                "eris_readiness": {"role": primary_role_with_eris, "score": primary_eris["score"], "gaps": gaps}
                if primary_eris else None,
                "skill_gaps": {"role": primary_role_with_eris, "gaps": gaps} if gaps else None,
                "github_activity": {
                    "repos": [
                        {
                            "name": r["repo_name"], "url": r["url"], "stars": r["stars"],
                            "languages": sorted(r["languages"] or {}, key=(r["languages"] or {}).get, reverse=True)[:3],
                            "lastCommitAt": r["last_commit_at"].isoformat(),
                        }
                        for r in recent
                    ],
                    "lastSyncAt": github["last_sync_at"].isoformat() if github and github["last_sync_at"] else None,
                } if recent else None,
                "profile_completeness": {"percent": round(completeness * 100), "checks": checks},
                # job_matches, project_ideas, collaboration, mentors, research: their
                # module integrations (Phase 4) supply data; until then they render "empty".
            },
            now=now,
        )

        # ── Independent Intelligence Engines ─────────────────────────────────
        graph = SkillGraph()
        direct_skills_dict = {index.names[sid]: readiness.get(sid, 0.5) for sid in readiness}
        inferred_map = graph.infer(direct_skills_dict)
        skill_graph_data = graph.build_graph(direct_skills_dict)
        target_role = roles[0] if roles else "ml_engineer"
        gaps_and_paths = generate_skill_gaps_and_recommendations(inferred_map, target_role, cur=cur)

        roadmap_user_data = {
            "name": user["name"],
            "role": user["role"],
            "university": user["university"],
            "degree": user["degree"],
            "department": user.get("department"),
            "academic_title": user.get("academic_title"),
            "job_title": user.get("job_title"),
            "career_role": target_role,
        }
        roadmap = generate_career_roadmap(roadmap_user_data, cur=cur)
        save_roadmap(cur, user_id, roadmap)
        next_actions = generate_next_best_actions(roadmap_user_data, gaps_and_paths.get("gaps", []), completeness)
        process_collaboration_embedding(cur, user_id)
        score_and_save_user_repos(cur, user_id)

        view = {
            "version": VIEW_VERSION,
            "computedAt": now.isoformat(),
            "trigger": job.payload.get("trigger"),
            "persona": persona,
            "identity": {
                "name": user["name"],
                "university": user["university"],
                "degree": user["degree"],
                "careerRole": roles[0] if roles else state["career_role_other"],
            },
            "goals": {"primaryRole": roles[0] if roles else None, "roles": roles,
                      "roleOther": state["career_role_other"], "priorities": state["priorities"] or []},
            "skills": skill_summary[:50],
            "inferredSkills": [
                {
                    "name": sname,
                    "strength": sdata["strength"],
                    "isDirect": sdata["is_direct"],
                    "inferredFrom": sdata["inferred_from"],
                }
                for sname, sdata in sorted(inferred_map.items(), key=lambda x: -x[1]["strength"])[:20]
            ],
            "skill_graph": skill_graph_data,
            "skillGraph": skill_graph_data,
            "skillGapsAndPaths": gaps_and_paths,
            "careerRoadmap": roadmap,
            "nextActions": next_actions,
            "projects": [
                {"canonicalTitle": u.canonical_title, "technologies": u.technologies, "status": u.status,
                 "matchConfidence": u.match_confidence, "signals": u.signals}
                for u in unified
            ],
            "erisScore": {
                "overall": primary_eris["score"] if primary_eris else None,
                "byRole": {r: v["score"] for r, v in eris_by_role.items()},
                "gaps": gaps,
            },
            "readinessIndicators": {
                "resumeLinked": any(f["origin"] == "resume" for f in facts),
                "connectorsCount": len(connections),
                "confirmedFacts": len(facts),
                "profileComplete": completeness,
            },
            "widgets": widget_list,
        }
        cur.execute(
            """INSERT INTO profile_views (user_id, view, updated_at) VALUES (%s, %s, %s)
               ON CONFLICT (user_id) DO UPDATE SET view = EXCLUDED.view, updated_at = EXCLUDED.updated_at""",
            (user_id, jsonb(view), now),
        )
        # The profile changed: rescore this user's student ↔ mentor matches.
        enqueue_compute_matches(cur, user_id, "profile_recomputed")
    log.info(
        "intelligence for %s: %d facts, %d skills, %d projects (%d matched), eris=%s, top widgets=%s",
        user_id, len(facts), len(skill_summary), len(unified), sum(u.status == "matched" for u in unified),
        {r: v["score"] for r, v in eris_by_role.items()}, [w["id"] for w in widget_list[:3]],
    )
