import { and, count, countDistinct, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  codeRepositories,
  collaborationEmbeddings,
  githubScores,
  opportunities,
  profileFacts,
  skillEvidence,
  skills,
} from "@/db/schema";

export interface JourneyMilestone {
  title: string;
  year: string;
  field: string;
  active?: boolean;
}

export interface RecentProjectItem {
  id: string;
  title: string;
  description: string;
  tags: string[];
  stars: number;
  forks: number;
  views: number;
  impact: number;
  url: string;
}

export interface GitHubActivityData {
  contributions: number;
  repositories: number;
  languages: number;
  pinned: number;
  hasRepos: boolean;
}

export interface PublicationItem {
  title: string;
  year: string;
  source: string;
  recordKey: string;
}

export interface AchievementItem {
  title: string;
  subtitle: string;
  category: "patent" | "certification" | "award" | "achievement";
  year?: string;
}

export interface OpportunityItem {
  id: string;
  title: string;
  org: string;
  match: string;
  matchPercentage: number;
  type: string;
  location?: string;
  deadline?: string;
  url: string;
}

export interface QuickActionItem {
  id: string;
  title: string;
  iconName: "Compass" | "Plus" | "BookOpen" | "Users" | "FileUp" | "Github" | "Sparkles";
  iconBg: string;
  href: string;
}

export interface LiveDashboardStats {
  profilePercent: number;
  skillsCount: number;
  githubReposCount: number;
  achievementsCount: number;
  opportunitiesCount: number;
  networkCount: number;
  milestones: JourneyMilestone[];
  recentProjects: RecentProjectItem[];
  githubActivity: GitHubActivityData | null;
  recentPublications: PublicationItem[];
  recentAchievements: AchievementItem[];
  skillProficiency: Array<{ name: string; pct: number }>;
  researchOpportunities: OpportunityItem[];
  internships: OpportunityItem[];
  quickActions: QuickActionItem[];
}

export async function getLiveDashboardData(
  userId: string,
  fallbackCompleteness = 0
): Promise<LiveDashboardStats> {
  const [
    skillsRes,
    reposRows,
    scoresRows,
    achievementsCountRes,
    networkRes,
    factsRows,
    evidenceSkills,
    oppsRows,
  ] = await Promise.all([
    // 1. Live Skills Count
    db
      .select({ count: countDistinct(skillEvidence.skillId) })
      .from(skillEvidence)
      .where(eq(skillEvidence.userId, userId))
      .catch(() => [{ count: 0 }]),

    // 2. Live GitHub Repositories
    db
      .select()
      .from(codeRepositories)
      .where(eq(codeRepositories.userId, userId))
      .orderBy(desc(codeRepositories.stars), desc(codeRepositories.lastCommitAt))
      .catch(() => []),

    // 3. GitHub AI Impact Scores
    db
      .select()
      .from(githubScores)
      .where(eq(githubScores.userId, userId))
      .catch(() => []),

    // 4. Live Achievements & Publications Count
    db
      .select({ count: countDistinct(profileFacts.recordKey) })
      .from(profileFacts)
      .where(
        and(
          eq(profileFacts.userId, userId),
          inArray(profileFacts.fieldGroup, [
            "achievements",
            "publications",
            "certifications",
            "achievement",
            "publication",
            "certification",
            "patents",
            "patent",
            "awards",
            "award",
          ])
        )
      )
      .catch(() => [{ count: 0 }]),

    // 5. Live Collaboration Network Count
    db
      .select({ count: count() })
      .from(collaborationEmbeddings)
      .where(ne(collaborationEmbeddings.userId, userId))
      .catch(() => [{ count: 0 }]),

    // 6. Raw Facts for Journey, Publications, and Achievements
    db
      .select({
        fieldGroup: profileFacts.fieldGroup,
        fieldName: profileFacts.fieldName,
        recordKey: profileFacts.recordKey,
        normalizedValue: profileFacts.normalizedValue,
        extractedValue: profileFacts.extractedValue,
      })
      .from(profileFacts)
      .where(eq(profileFacts.userId, userId))
      .catch(() => []),

    // 7. Evidenced skills with strength ratings
    db
      .select({
        skillName: skills.canonicalName,
        strength: skillEvidence.evidenceStrength,
      })
      .from(skillEvidence)
      .innerJoin(skills, eq(skillEvidence.skillId, skills.id))
      .where(eq(skillEvidence.userId, userId))
      .catch(() => []),

    // 8. Live Opportunities
    db
      .select()
      .from(opportunities)
      .catch(() => []),
  ]);

  // Determine user skill names and counts
  let skillsCount = skillsRes[0]?.count ?? 0;
  const userSkillNames = new Set<string>();
  const skillProficiencyMap = new Map<string, number>();

  for (const s of evidenceSkills) {
    if (!s.skillName) continue;
    userSkillNames.add(s.skillName.toLowerCase());
    const current = skillProficiencyMap.get(s.skillName) ?? 0;
    const strengthNum = typeof s.strength === "number" ? s.strength : parseFloat(String(s.strength || "0.7"));
    const pct = Math.min(100, Math.max(30, Math.round(strengthNum * 100)));
    if (pct > current) {
      skillProficiencyMap.set(s.skillName, pct);
    }
  }

  // Also check profileFacts if evidenceSkills is thin
  if (userSkillNames.size === 0) {
    for (const f of factsRows) {
      if (f.fieldGroup === "skills" && (f.normalizedValue || f.extractedValue)) {
        const val = String(f.normalizedValue || f.extractedValue).trim();
        userSkillNames.add(val.toLowerCase());
        skillProficiencyMap.set(val, 75);
      }
    }
    if (skillsCount === 0) {
      skillsCount = userSkillNames.size;
    }
  }

  const skillProficiency = Array.from(skillProficiencyMap.entries())
    .map(([name, pct]) => ({ name, pct }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 8);

  const githubReposCount = reposRows.length;
  const achievementsCount = achievementsCountRes[0]?.count ?? 0;
  const networkCount = networkRes[0]?.count ?? 0;
  const opportunitiesCount = oppsRows.length;

  // Build Scores map for repos
  const scoreMap = new Map<string, number>();
  for (const s of scoresRows) {
    scoreMap.set(s.repoId, s.impactScore);
    if (s.repoName) {
      scoreMap.set(s.repoName.toLowerCase(), s.impactScore);
    }
  }

  // Build Recent Projects
  const recentProjects: RecentProjectItem[] = reposRows.slice(0, 3).map((r) => {
    const langs = Object.keys((r.languages as Record<string, number>) || {});
    const topics = (r.topics as string[]) || [];
    const tags = [...langs.slice(0, 2), ...topics.slice(0, 2)];
    const impact = scoreMap.get(String(r.id)) || scoreMap.get(r.repoName.toLowerCase()) || 80;

    return {
      id: r.id,
      title: r.repoName,
      description: r.description || "Verified code repository synced with GitHub.",
      tags: tags.length > 0 ? tags : ["Source Code"],
      stars: r.stars || 0,
      forks: r.forks || 0,
      views: Math.max((r.stars || 0) * 4 + (r.forks || 0) * 2, 12),
      impact,
      url: r.url || "#",
    };
  });

  // Build GitHub Activity
  let distinctLanguagesCount = 0;
  const allLanguages = new Set<string>();
  for (const r of reposRows) {
    const lObj = (r.languages as Record<string, number>) || {};
    Object.keys(lObj).forEach((l) => allLanguages.add(l.toLowerCase()));
  }
  distinctLanguagesCount = allLanguages.size;

  const githubActivity: GitHubActivityData | null =
    reposRows.length > 0
      ? {
          contributions: Math.max(reposRows.length * 12, 24),
          repositories: reposRows.length,
          languages: distinctLanguagesCount || 1,
          pinned: Math.min(reposRows.length, 6),
          hasRepos: true,
        }
      : null;

  // Group Facts by recordKey
  const factsMap = new Map<string, { group: string; fields: Record<string, string> }>();
  for (const row of factsRows) {
    if (!row.recordKey) continue;
    if (!factsMap.has(row.recordKey)) {
      factsMap.set(row.recordKey, { group: row.fieldGroup, fields: {} });
    }
    const entry = factsMap.get(row.recordKey)!;
    entry.fields[row.fieldName.toLowerCase()] = String(row.normalizedValue || row.extractedValue || "");
  }

  // Build Journey Milestones
  const rawMilestones: Array<{
    title: string;
    year: string;
    field: string;
    active: boolean;
    sortKey: number;
  }> = [];

  const recentPublications: PublicationItem[] = [];
  const recentAchievements: AchievementItem[] = [];

  for (const [recKey, rec] of factsMap.entries()) {
    const f = rec.fields;
    const g = rec.group.toLowerCase();

    // Journey Timeline
    if (g === "education" || g === "experience") {
      const isEdu = g === "education";
      let title = "";
      let field = "";
      let year = "";
      let isPresent = false;

      if (isEdu) {
        title = f["degree"] || f["degree_name"] || "Degree";
        field = f["field_of_study"] || f["major"] || f["institution"] || "CSE";
        const start = f["start_date"] || f["start_year"] || "";
        const end = f["end_date"] || f["end_year"] || "";
        isPresent = end.toLowerCase().includes("present");
        year = end || start || "Academic";
      } else {
        title = f["role"] || f["job_title"] || "Role";
        field = f["organization"] || f["company"] || "Industry";
        const start = f["start_date"] || "";
        const end = f["end_date"] || "";
        isPresent = end.toLowerCase().includes("present") || !end;
        year = isPresent ? `${start ? start + "–" : ""}Present` : end || start || "Career";
      }

      const yearMatch = year.match(/\b(19\d\d|20\d\d)\b/);
      const sortKey = isPresent ? 9999 : yearMatch ? parseInt(yearMatch[1], 10) : 2000;

      rawMilestones.push({
        title: title.slice(0, 20),
        year,
        field: field.slice(0, 24),
        active: isPresent,
        sortKey,
      });
    }

    // Publications
    if (g.includes("pub")) {
      recentPublications.push({
        title: f["title"] || f["paper_title"] || "Research Publication",
        year: f["year"] || f["date"] || "2024",
        source: f["venue"] || f["journal"] || f["publisher"] || "Peer Reviewed",
        recordKey: recKey,
      });
    }

    // Achievements, Certifications, Patents, Awards
    if (g.includes("achieve") || g.includes("cert") || g.includes("patent") || g.includes("award")) {
      const isPatent = g.includes("patent");
      const isCert = g.includes("cert");
      const isAward = g.includes("award");
      const category = isPatent ? "patent" : isCert ? "certification" : isAward ? "award" : "achievement";

      recentAchievements.push({
        title: f["title"] || f["name"] || f["award_name"] || "Technical Milestone",
        subtitle: f["issuer"] || f["organization"] || f["description"] || "Verified Credential",
        category,
        year: f["year"] || f["date"],
      });
    }
  }

  // Sort Milestones chronologically
  rawMilestones.sort((a, b) => a.sortKey - b.sortKey);
  if (rawMilestones.length > 0) {
    rawMilestones[rawMilestones.length - 1].active = true;
  }
  const milestones: JourneyMilestone[] = rawMilestones.map(({ title, year, field, active }) => ({
    title,
    year,
    field,
    active,
  }));

  // Match Opportunities against user's live skills
  const scoredOpps: OpportunityItem[] = oppsRows.map((opp) => {
    const required = (opp.requiredSkills || []).map((s) => s.toLowerCase());
    let matchPct = 0;
    if (required.length > 0 && userSkillNames.size > 0) {
      const matches = required.filter((s) => userSkillNames.has(s)).length;
      matchPct = Math.round((matches / required.length) * 100);
      // Give a boost if multiple core skills align
      if (matches >= 2) matchPct = Math.max(matchPct, 82);
    } else if (userSkillNames.size > 0) {
      matchPct = 70;
    }

    return {
      id: opp.id,
      title: opp.title,
      org: opp.organization,
      match: matchPct > 0 ? `${matchPct}% Match` : "Skills Required",
      matchPercentage: matchPct,
      type: opp.type,
      location: opp.location || undefined,
      deadline: opp.deadline || undefined,
      url: opp.url || "/opportunities",
    };
  });

  const researchOpportunities = scoredOpps.filter((o) => o.type === "research" || o.type === "grant");
  const internships = scoredOpps.filter((o) => o.type === "internship");

  // Dynamic Quick Actions based on missing sections or next steps
  const quickActions: QuickActionItem[] = [];
  const hasResume = factsRows.some((f) => f.fieldGroup === "education" || f.fieldGroup === "experience");

  if (!hasResume) {
    quickActions.push({
      id: "resume",
      title: "Upload your resume or CV",
      iconName: "FileUp",
      iconBg: "bg-[#EDF5FF] text-[#2878F0]",
      href: "/onboarding/resume",
    });
  }

  if (reposRows.length === 0) {
    quickActions.push({
      id: "github",
      title: "Connect your GitHub account",
      iconName: "Github",
      iconBg: "bg-[#F3EFFF] text-[#8554FF]",
      href: "/settings/integrations",
    });
  }

  if (skillsCount < 3) {
    quickActions.push({
      id: "skills",
      title: "Confirm your core competencies",
      iconName: "Sparkles",
      iconBg: "bg-[#FFF0F4] text-[#FF496D]",
      href: "/skills",
    });
  }

  quickActions.push({
    id: "learning",
    title: "Improve skills with a learning path",
    iconName: "BookOpen",
    iconBg: "bg-[#E8FAF4] text-[#19C58A]",
    href: "/learning",
  });

  quickActions.push({
    id: "collaborators",
    title: "Find potential collaborators",
    iconName: "Users",
    iconBg: "bg-[#E6F8FB] text-[#00AEC7]",
    href: "/people",
  });

  if (quickActions.length < 4) {
    quickActions.push({
      id: "project",
      title: "Add your latest engineering project",
      iconName: "Plus",
      iconBg: "bg-[#EDF5FF] text-[#2878F0]",
      href: "/projects",
    });
  }

  // Calculate dynamic profile completeness percentage based on real assets
  let computedPercent = 0;
  if (hasResume) computedPercent += 35;
  if (reposRows.length > 0) computedPercent += 25;
  if (skillsCount >= 3) computedPercent += 20;
  if (achievementsCount > 0) computedPercent += 10;
  if (networkCount > 0) computedPercent += 10;

  const profilePercent = fallbackCompleteness > 0 ? fallbackCompleteness : computedPercent;

  return {
    profilePercent,
    skillsCount,
    githubReposCount,
    achievementsCount,
    opportunitiesCount,
    networkCount,
    milestones,
    recentProjects,
    githubActivity,
    recentPublications,
    recentAchievements,
    skillProficiency,
    researchOpportunities,
    internships,
    quickActions: quickActions.slice(0, 4),
  };
}
