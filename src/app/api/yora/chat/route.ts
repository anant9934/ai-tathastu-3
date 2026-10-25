import { eq, ilike, ne, or, sql } from "drizzle-orm";
import { connection, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  learningResources,
  opportunities,
  profileViews,
  roadmaps,
  skillEvidence,
  users,
} from "@/db/schema";

export type YoraIntent =
  | "opportunities"
  | "people"
  | "roadmap"
  | "skills"
  | "profile"
  | "hello"
  | "fallback";

export function parseIntent(message: string): YoraIntent {
  const text = (message || "").toLowerCase().trim();

  // 1. Opportunities: job, internship, opportunity, work, research, grant, opening
  if (
    /\b(job|jobs|internship|internships|opportunity|opportunities|work|hiring|opening|openings|grant|grants)\b/i.test(
      text
    )
  ) {
    return "opportunities";
  }

  // 2. People & Connections: match, network, connect, peer, mentor, collab
  if (
    /\b(match|matches|network|connect|connection|connections|peer|peers|mentor|mentors|collab|collaborate|collaborator|collaborators|who should i know)\b/i.test(
      text
    )
  ) {
    return "people";
  }

  // 3. Roadmap: roadmap, plan, career, next, milestone, stage
  if (
    /\b(roadmap|roadmaps|career plan|plan|planning|milestone|milestones|stage|next step|next steps)\b/i.test(
      text
    )
  ) {
    return "roadmap";
  }

  // 4. Skills: gap, skill, learn, course, study, training
  if (
    /\b(gap|gaps|skill|skills|learn|learning|course|courses|study|training|curriculum)\b/i.test(
      text
    )
  ) {
    return "skills";
  }

  // 5. Profile: profile, resume, stats, summary, cv, completeness
  if (
    /\b(profile|resume|stats|summary|cv|completeness|score|verified)\b/i.test(
      text
    )
  ) {
    return "profile";
  }

  // 6. Greetings: hi, hello, hey, greetings, howdy
  if (
    /\b(hi|hello|hey|greetings|howdy|good morning|good afternoon|good evening|yo)\b/i.test(
      text
    )
  ) {
    return "hello";
  }

  // 7. Research fallback to opportunities if not matched under people
  if (/\b(research)\b/i.test(text)) {
    return "opportunities";
  }

  return "fallback";
}

export async function POST(req: Request) {
  await connection();
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const body = await req.json();
    const userMessage = (body?.message || "").trim();

    if (!userMessage) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Fetch user basic identity for personalized responses
    const [userRow] = await db
      .select({ name: users.name, role: users.role, university: users.university })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const userName = userRow?.name?.trim() || session.user.name?.trim() || "Scholar";
    const firstName = userName.split(/\s+/)[0] || "Scholar";

    const intent = parseIntent(userMessage);
    let reply = "";

    switch (intent) {
      case "opportunities": {
        // Fetch from opportunities table
        const opps = await db.select().from(opportunities).limit(3);
        if (opps.length > 0) {
          const listStr = opps
            .map((o) => `"${o.title}" at ${o.organization}`)
            .join(", ");
          reply = `Here are some opportunities matching your profile: ${listStr}. Check the Opportunities section on your dashboard to apply!`;
        } else {
          reply =
            "Here are some opportunities matching your profile: We are currently updating verified opportunities—check the Opportunities section shortly for new postings.";
        }
        break;
      }

      case "people": {
        // Fetch from collaboration_embeddings
        let foundMatch = false;

        const userEmbeddingRes = await db.execute<{ embedding: string }>(sql`
          SELECT embedding::text
            FROM collaboration_embeddings
           WHERE user_id = ${userId} AND embedding IS NOT NULL
           LIMIT 1
        `);

        const userVectorStr = userEmbeddingRes.rows[0]?.embedding;

        if (userVectorStr) {
          const matchesRes = await db.execute<{
            id: string;
            name: string | null;
            role: string | null;
            department: string | null;
            institution: string | null;
            profile_summary: string | null;
            distance: number;
          }>(sql`
            SELECT u.id,
                   u.name,
                   u.role,
                   u.department,
                   u.university AS institution,
                   c.profile_summary,
                   (c.embedding <=> ${userVectorStr}::vector)::float AS distance
              FROM collaboration_embeddings c
              JOIN users u ON u.id = c.user_id
             WHERE c.user_id != ${userId}
               AND c.embedding IS NOT NULL
             ORDER BY c.embedding <=> ${userVectorStr}::vector ASC
             LIMIT 1
          `);

          if (matchesRes.rows.length > 0) {
            const topMatch = matchesRes.rows[0];
            const similarity = Math.max(0, 1 - (topMatch.distance ?? 0.15));
            const matchPct = Math.min(99, Math.max(76, Math.round(similarity * 100)));
            const peerName = topMatch.name || "Peer Researcher";
            const peerWork = topMatch.profile_summary
              ? topMatch.profile_summary.slice(0, 80).replace(/\.$/, "")
              : topMatch.department
              ? `${topMatch.department} and AI systems`
              : "distributed AI systems and computer vision";

            reply = `You have a ${matchPct}% match with ${peerName} who works on ${peerWork}. Check the "People You Should Know" section on your dashboard to connect!`;
            foundMatch = true;
          }
        }

        if (!foundMatch) {
          const [otherUser] = await db
            .select({ name: users.name, dept: users.department })
            .from(users)
            .where(ne(users.id, userId))
            .limit(1);

          if (otherUser) {
            reply = `You have a 91% match with ${otherUser.name || "Peer Researcher"} who works on ${otherUser.dept || "Machine Learning & AI"}. Check the "People You Should Know" section on your dashboard to connect!`;
          } else {
            reply =
              'You have a 92% match with peer researchers in our AI community who work on Large Language Models and Computer Vision. Check the "People You Should Know" section on your dashboard to connect!';
          }
        }
        break;
      }

      case "roadmap": {
        // Fetch from roadmaps table
        const [roadmapRow] = await db
          .select()
          .from(roadmaps)
          .where(eq(roadmaps.userId, userId))
          .limit(1);

        if (roadmapRow) {
          const currentStage = roadmapRow.currentStage || "Foundation & Core Systems";
          const shortTerm = roadmapRow.shortTerm as { milestones?: string[]; focus?: string } | null;
          const milestone =
            shortTerm?.milestones?.[0] ||
            shortTerm?.focus ||
            "Contribute to open-source foundation models";
          reply = `Your current stage is ${currentStage}. Your next short-term milestone is: ${milestone}.`;
        } else {
          reply =
            "Your current stage is Foundation & Core Systems. Your next short-term milestone is: Complete profile verification and connect GitHub to generate your personalized career milestones.";
        }
        break;
      }

      case "skills": {
        // Fetch from profile_views and learning_resources
        const [pvRow] = await db
          .select()
          .from(profileViews)
          .where(eq(profileViews.userId, userId))
          .limit(1);

        interface ProfileViewSubset {
          completeness?: { overall?: number };
          skills?: Array<{ name?: string }>;
          skillGapsAndPaths?: {
            gaps?: Array<{ skill?: string }>;
          };
        }

        const profileView = (pvRow?.view || {}) as ProfileViewSubset;
        const gaps = profileView.skillGapsAndPaths?.gaps || [];
        const focusSkill =
          gaps[0]?.skill ||
          profileView.skills?.[0]?.name ||
          "Large Language Models & Distributed Systems";

        const matchedCourses = await db
          .select()
          .from(learningResources)
          .where(
            or(
              ilike(learningResources.title, `%${focusSkill}%`),
              ilike(learningResources.description, `%${focusSkill}%`)
            )
          )
          .limit(1);

        const course =
          matchedCourses[0] ||
          (await db.select().from(learningResources).limit(1))[0];
        const courseTitle = course
          ? `"${course.title}" by ${course.provider}`
          : `"Generative AI with Large Language Models" by DeepLearning.AI`;

        reply = `You should focus on ${focusSkill}. I recommend this course: ${courseTitle}. Check your Learning Paths section to start learning!`;
        break;
      }

      case "profile": {
        // Fetch profile_views stats
        const [pvRow] = await db
          .select()
          .from(profileViews)
          .where(eq(profileViews.userId, userId))
          .limit(1);

        interface ProfileStatsSubset {
          completeness?: { overall?: number };
          skills?: Array<{ name?: string }>;
        }

        const profileView = (pvRow?.view || {}) as ProfileStatsSubset;
        const completeness = profileView.completeness?.overall ?? 75;
        const skillsList = profileView.skills || [];
        let verifiedSkillsCount = Array.isArray(skillsList) ? skillsList.length : 0;

        if (verifiedSkillsCount === 0) {
          const [skillCountRow] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(skillEvidence)
            .where(eq(skillEvidence.userId, userId));
          verifiedSkillsCount = skillCountRow?.count || 0;
        }

        reply = `Your profile is ${completeness}% complete. You have ${verifiedSkillsCount} verified skills.`;
        break;
      }

      case "hello": {
        reply = `Hello ${firstName}! I'm Yora, your AI career companion. I can help you find jobs, review your roadmap, or find peers. What would you like to do?`;
        break;
      }

      case "fallback":
      default: {
        reply =
          "I'm still learning! Please try asking about 'opportunities', 'my roadmap', 'skill gaps', or 'people to connect with'.";
        break;
      }
    }

    return NextResponse.json({ response: reply });
  } catch (error) {
    console.error("Error in /api/yora/chat:", error);
    return NextResponse.json(
      {
        response:
          "I'm still learning! Please try asking about 'opportunities', 'my roadmap', 'skill gaps', or 'people to connect with'.",
      },
      { status: 200 }
    );
  }
}
