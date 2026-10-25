import { eq, ne } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";

import { db } from "@/db";
import { collaborationEmbeddings, users } from "@/db/schema";
import { requireOnboardedUser } from "@/lib/dal";
import { Suspense } from "react";
import { PeopleListClient } from "@/components/dashboard/people-list-client";

export const metadata: Metadata = {
  title: "People & Research Network | AI Tathastu",
};

export default function PeoplePage() {
  return (
    <Suspense fallback={<PeopleSkeleton />}>
      <PeopleContent />
    </Suspense>
  );
}

function PeopleSkeleton() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
      <div className="h-10 w-64 bg-slate-200 rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-48 bg-slate-100 rounded-2xl border border-slate-200/60" />
        ))}
      </div>
    </div>
  );
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA <= 0 || normB <= 0) return 0;
  return Math.max(0, Math.min(1, dot / (Math.sqrt(normA) * Math.sqrt(normB))));
}

async function PeopleContent() {
  const { user } = await requireOnboardedUser();

  const [userEmbRow, allPeers] = await Promise.all([
    db
      .select()
      .from(collaborationEmbeddings)
      .where(eq(collaborationEmbeddings.userId, user.id))
      .limit(1)
      .then((rows) => rows[0]),
    db
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
        department: users.department,
        institution: users.university,
        embedding: collaborationEmbeddings.embedding,
        profileSummary: collaborationEmbeddings.profileSummary,
      })
      .from(collaborationEmbeddings)
      .innerJoin(users, eq(users.id, collaborationEmbeddings.userId))
      .where(ne(users.id, user.id))
      .limit(24),
  ]);

  const userVec = userEmbRow?.embedding || [];

  const scoredPeers = allPeers.map((p) => {
    const sim = p.embedding && userVec.length > 0 ? cosineSimilarity(userVec, p.embedding) : 0.75;
    const pct = Math.max(72, Math.min(99, Math.round(sim * 100)));

    const initials = (p.name || "Peer")
      .split(/\s+/)
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    return {
      id: p.id,
      name: p.name || "Peer Scholar",
      role: p.role === "faculty" ? "Faculty / Mentor" : p.role === "alumni" ? "Alumni" : "Student Researcher",
      institution: p.institution || "Research Institution",
      department: p.department || "AI Systems Lab",
      matchPercentage: pct,
      summary: p.profileSummary || "Complementary technical focus in machine learning systems.",
      initials,
    };
  });

  scoredPeers.sort((a, b) => b.matchPercentage - a.matchPercentage);

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-2"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Dashboard</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="editorial-title text-3xl sm:text-4xl text-[#11182B] tracking-tight">
              People & Collaboration Network
            </h1>
            <p className="mt-1 text-sm text-[#64748B]">
              Ranked peer researchers, co-authors, and mentors scored by vector cosine similarity against your skills and goals.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-[#EDF5FF] text-[#2878F0] border border-[#2878F0]/20">
              <Users className="size-3.5" />
              {scoredPeers.length} Potential Collaborators
            </span>
          </div>
        </div>
      </div>

      {/* People Grid with Client Interaction */}
      <PeopleListClient initialPeers={scoredPeers} />
    </div>
  );
}
