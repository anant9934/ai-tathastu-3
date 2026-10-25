/**
 * /api/internal/notify: only the worker (shared secret) can call it, the
 * email is decided from the database, and each job notifies at most once.
 */
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "internal-secret-for-tests-0123456789abcdef";
process.env.INTERNAL_API_SECRET = SECRET;

const sent = vi.hoisted(() => [] as { profile: string; to: string; subject: string }[]);

vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  return { db: await createTestDb() };
});
vi.mock("@/lib/email", () => ({
  sendEmail: async ({ profile, to, email }: { profile: string; to: string; email: { subject: string } }) => {
    sent.push({ profile, to, subject: email.subject });
    return { messageId: "x", accepted: [to] };
  },
}));

const { db } = await import("@/db");
const schema = await import("@/db/schema");
const { POST } = await import("./route");

const USER = "00000000-0000-4000-8000-0000000000c1";
let seq = 0;

async function addJob(type: "resume_extract" | "connector_sync", status: "done" | "failed" | "needs_review", payload = {}) {
  const [job] = await db
    .insert(schema.jobs)
    .values({ type, userId: USER, status, idempotencyKey: `test:${++seq}`, payload, createdAt: new Date(Date.now() + seq * 1000) })
    .returning();
  return job;
}

const call = (jobId: string, secret = SECRET) =>
  POST(new Request("https://www.aitathastu.com/api/internal/notify", {
    method: "POST",
    headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
    body: JSON.stringify({ jobId }),
  }));

beforeAll(async () => {
  await db.insert(schema.users).values({ id: USER, email: "asha@example.com", name: "Asha Rao" });
  await db.insert(schema.onboardingState).values({ userId: USER, currentStep: "resume" });
});
beforeEach(() => {
  sent.length = 0;
});

describe("auth", () => {
  it("401 without the shared secret, or with the wrong one", async () => {
    const job = await addJob("resume_extract", "done");
    expect((await call(job.id, "wrong-secret-of-the-same-length-000000000")).status).toBe(401);
    expect((await POST(new Request("https://x/api/internal/notify", { method: "POST", body: "{}" }))).status).toBe(401);
    expect(sent).toHaveLength(0);
  });
});

describe("what gets sent", () => {
  it("resume done → 'ready' from the system sender, once", async () => {
    const job = await addJob("resume_extract", "done", { fileName: "cv.pdf" });
    expect(await (await call(job.id)).json()).toEqual({ sent: "resume_ready" });
    expect(sent).toEqual([{ profile: "system", to: "asha@example.com", subject: "Your resume is ready to review" }]);
    expect(await (await call(job.id)).json()).toMatchObject({ sent: null, reason: "already notified" });
    expect(sent).toHaveLength(1);
  });

  it("resume failed → 'couldn't read' email", async () => {
    const job = await addJob("resume_extract", "needs_review");
    expect(await (await call(job.id)).json()).toEqual({ sent: "resume_failed" });
    expect(sent[0]).toMatchObject({ profile: "system", subject: "We couldn't read your resume" });
  });

  it("a superseded extraction stays quiet; only the newest one notifies", async () => {
    const older = await addJob("resume_extract", "done");
    await addJob("resume_extract", "queued" as never);
    expect(await (await call(older.id)).json()).toEqual({ sent: null });
  });

  it("connector the user must fix → support alert; consent-parked sync → nothing", async () => {
    const [github] = await db
      .insert(schema.connections)
      .values({ userId: USER, sourceId: "github", accessMethod: "oauth", status: "reauth_needed" })
      .returning();
    const revoked = await addJob("connector_sync", "needs_review", { connection_id: github.id });
    expect(await (await call(revoked.id)).json()).toEqual({ sent: "connector_attention" });
    expect(sent[0]).toMatchObject({ profile: "support", subject: "Your GitHub connection needs attention" });

    const [linkedin] = await db
      .insert(schema.connections)
      .values({ userId: USER, sourceId: "linkedin", accessMethod: "public_scrape", status: "syncing" })
      .returning();
    const parked = await addJob("connector_sync", "needs_review", { connection_id: linkedin.id });
    expect(await (await call(parked.id)).json()).toEqual({ sent: null });
    expect(sent).toHaveLength(1);
  });

  it("deleted accounts get nothing", async () => {
    const job = await addJob("resume_extract", "failed");
    await db.update(schema.users).set({ deletedAt: new Date() }).where(eq(schema.users.id, USER));
    expect(await (await call(job.id)).json()).toEqual({ sent: null });
    await db.update(schema.users).set({ deletedAt: null }).where(eq(schema.users.id, USER));
  });
});
