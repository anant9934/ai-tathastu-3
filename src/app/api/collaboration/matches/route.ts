import { sql } from "drizzle-orm";
import { connection, NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/db";

export async function GET() {
  await connection();
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUserId = session.user.id;

  try {
    // 1. Fetch current user's embedding vector
    const userEmbeddingRes = await db.execute<{ embedding: string }>(sql`
      SELECT embedding::text
        FROM collaboration_embeddings
       WHERE user_id = ${currentUserId} AND embedding IS NOT NULL
       LIMIT 1
    `);

    const userVectorStr = userEmbeddingRes.rows[0]?.embedding;

    if (userVectorStr) {
      // 2. Query other candidates ordered by pgvector cosine distance (<=>)
      const matchesRes = await db.execute<{
        id: string;
        name: string | null;
        role: string | null;
        department: string | null;
        institution: string | null;
        distance: number;
      }>(sql`
        SELECT u.id,
               u.name,
               u.role,
               u.department,
               u.university AS institution,
               (c.embedding <=> ${userVectorStr}::vector)::float AS distance
          FROM collaboration_embeddings c
          JOIN users u ON u.id = c.user_id
         WHERE c.user_id != ${currentUserId}
           AND c.embedding IS NOT NULL
         ORDER BY c.embedding <=> ${userVectorStr}::vector ASC
         LIMIT 5
      `);

      if (matchesRes.rows.length > 0) {
        const matches = matchesRes.rows.map((c) => {
          // Cosine similarity is 1 - cosine distance
          const similarity = Math.max(0, 1 - (c.distance ?? 0.2));
          const matchPct = Math.min(99, Math.max(75, Math.round(similarity * 100)));
          return {
            id: c.id,
            name: c.name || "Peer Researcher",
            role: c.role || "Researcher",
            institution: c.institution || "Research Institute",
            department: c.department || "Computer Science",
            matchPercentage: matchPct,
            reason: "High semantic profile alignment across technical skills and research topics",
            initials: (c.name || "PR")
              .split(/\s+/)
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase(),
            color: "bg-blue-100 text-blue-700",
          };
        });

        return NextResponse.json({ matches });
      }
    }

    return NextResponse.json({ matches: [] });
  } catch (error) {
    console.error("Error in GET /api/collaboration/matches:", error);
    return NextResponse.json({ matches: [] });
  }
}
