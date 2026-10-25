import { and, count, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { connections, jobs, onboardingState, profileFacts, users } from "@/db/schema";
import { sourceById } from "@/lib/connectors/sources";
import { isInternalCall } from "@/lib/internal-auth";
import { sendEmail, type SenderProfile } from "@/lib/email";
import {
  appUrl,
  connectorAttentionEmail,
  resumeFailedEmail,
  resumeReadyEmail,
  type Email,
} from "@/lib/email/templates";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/internal/notify { jobId } — called by the worker when a
 * resume_extract or connector_sync job ends. Render's free tier blocks
 * outbound SMTP, so the worker can't send mail itself; this route sends it
 * from Vercel instead.
 *
 * Bearer INTERNAL_API_SECRET (shared with the worker). The body carries only a
 * job id: what to send, and to whom, is decided from the database, so a
 * leaked secret can't be used to email arbitrary content or addresses. Each
 * job notifies at most once (payload.notified_at, claimed atomically).
 */
export async function POST(request: Request) {
  if (!isInternalCall(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { jobId?: unknown } | null;
  const jobId = typeof body?.jobId === "string" && UUID.test(body.jobId) ? body.jobId : null;
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 422 });

  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });

  const plan = await planFor(job);
  if (!plan) return NextResponse.json({ sent: null });

  // Claim the notification before sending, so a repeated call can't send twice.
  const [claimed] = await db
    .update(jobs)
    .set({ payload: sql`${jobs.payload} || jsonb_build_object('notified_at', now())` })
    .where(and(eq(jobs.id, job.id), sql`NOT (${jobs.payload} ? 'notified_at')`))
    .returning({ id: jobs.id });
  if (!claimed) return NextResponse.json({ sent: null, reason: "already notified" });

  try {
    await sendEmail({ profile: plan.profile, to: plan.to, email: plan.email });
  } catch (error) {
    console.error(`notify: ${plan.template} for job ${job.id} failed`, error);
    await db
      .update(jobs)
      .set({ payload: sql`${jobs.payload} - 'notified_at'` })
      .where(eq(jobs.id, job.id));
    return NextResponse.json({ error: "send failed" }, { status: 502 });
  }
  return NextResponse.json({ sent: plan.template });
}

type Plan = { template: string; profile: SenderProfile; to: string; email: Email };

async function planFor(job: typeof jobs.$inferSelect): Promise<Plan | null> {
  const [user] = await db
    .select({ email: users.email, name: users.name, deletedAt: users.deletedAt, step: onboardingState.currentStep })
    .from(users)
    .leftJoin(onboardingState, eq(onboardingState.userId, users.id))
    .where(eq(users.id, job.userId));
  if (!user?.email || user.deletedAt) return null;
  const firstName = user.name?.trim().split(/\s+/)[0] ?? null;
  const onboarded = user.step === "done";
  const fileName = typeof job.payload.fileName === "string" ? job.payload.fileName : null;

  if (job.type === "resume_extract") {
    // A newer extraction (e.g. re-read after AI consent) supersedes this one: only it notifies.
    const [newer] = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(and(eq(jobs.userId, job.userId), eq(jobs.type, "resume_extract"), gt(jobs.createdAt, job.createdAt)))
      .orderBy(desc(jobs.createdAt))
      .limit(1);
    if (newer) return null;

    if (job.status === "done") {
      const [{ n }] = await db
        .select({ n: count() })
        .from(profileFacts)
        .where(
          and(
            eq(profileFacts.userId, job.userId),
            eq(profileFacts.origin, "resume"),
            eq(profileFacts.confirmation, "unconfirmed"),
            isNull(profileFacts.supersededBy),
          ),
        );
      return {
        template: "resume_ready",
        profile: "system",
        to: user.email,
        email: resumeReadyEmail({
          firstName,
          fileName,
          fieldCount: n,
          reviewUrl: appUrl(onboarded ? "/profile" : "/onboarding/resume/review"),
        }),
      };
    }
    if (job.status === "failed" || job.status === "needs_review") {
      return {
        template: "resume_failed",
        profile: "system",
        to: user.email,
        email: resumeFailedEmail({ firstName, fileName, uploadUrl: appUrl(onboarded ? "/profile" : "/onboarding/resume") }),
      };
    }
    return null;
  }

  if (job.type === "connector_sync" && (job.status === "failed" || job.status === "needs_review")) {
    const connectionId = typeof job.payload.connection_id === "string" ? job.payload.connection_id : null;
    if (!connectionId) return null;
    const [connection] = await db
      .select({ sourceId: connections.sourceId, status: connections.status })
      .from(connections)
      .where(eq(connections.id, connectionId));
    // Only when the user has to act: not a sync parked on consent, not one that recovered.
    if (!connection || (connection.status !== "reauth_needed" && connection.status !== "failed")) return null;
    const sourceName = sourceById(connection.sourceId)?.name ?? connection.sourceId;
    return {
      template: "connector_attention",
      profile: "support",
      to: user.email,
      email: connectorAttentionEmail({
        firstName,
        sourceName,
        reason:
          connection.status === "reauth_needed"
            ? `${sourceName} access was revoked or has expired.`
            : `The last import from ${sourceName} failed after several tries.`,
        manageUrl: appUrl(onboarded ? "/connections" : "/onboarding/connect-sources"),
      }),
    };
  }
  return null;
}
