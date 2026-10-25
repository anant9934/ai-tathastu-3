import "server-only";

import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { wakeWorker } from "@/lib/worker-ping";

/**
 * Queues compute_intelligence unless one is already waiting (it will read the
 * latest data anyway). Only after onboarding: "Generate my profile" queues
 * the first run. Mirrors enqueue_compute_intelligence in worker/db.py.
 */
export async function enqueueComputeIntelligence(userId: string, trigger: string) {
  await db.execute(sql`
    INSERT INTO jobs (type, user_id, idempotency_key, payload)
    SELECT 'compute_intelligence', ${userId}, ${`compute_intelligence:${userId}:${randomUUID()}`}, ${JSON.stringify({ trigger })}::jsonb
     WHERE EXISTS (SELECT 1 FROM onboarding_state WHERE user_id = ${userId} AND current_step = 'done')
       AND NOT EXISTS (SELECT 1 FROM jobs WHERE user_id = ${userId} AND type = 'compute_intelligence' AND status = 'queued')
    ON CONFLICT (idempotency_key) DO NOTHING`);
  wakeWorker(`compute_intelligence:${trigger}`);
}

/**
 * Asynchronously triggers background recomputation for roadmap, intelligence,
 * and peer collaboration matches without blocking the UI response.
 */
export async function triggerRecompute(userId: string, trigger: string) {
  try {
    await db.execute(sql`
      INSERT INTO jobs (type, user_id, idempotency_key, payload)
      SELECT 'compute_intelligence', ${userId}, ${`compute_intelligence:${userId}:${randomUUID()}`}, ${JSON.stringify({ trigger })}::jsonb
       WHERE NOT EXISTS (SELECT 1 FROM jobs WHERE user_id = ${userId} AND type = 'compute_intelligence' AND status = 'queued')
      ON CONFLICT (idempotency_key) DO NOTHING`);

    await db.execute(sql`
      INSERT INTO jobs (type, user_id, idempotency_key, payload)
      SELECT 'compute_matches', ${userId}, ${`compute_matches:${userId}:${randomUUID()}`}, ${JSON.stringify({ trigger })}::jsonb
       WHERE NOT EXISTS (SELECT 1 FROM jobs WHERE user_id = ${userId} AND type = 'compute_matches' AND status = 'queued')
      ON CONFLICT (idempotency_key) DO NOTHING`);

    await db.execute(sql`
      INSERT INTO jobs (type, user_id, idempotency_key, payload)
      SELECT 'generate_roadmap', ${userId}, ${`generate_roadmap:${userId}:${randomUUID()}`}, ${JSON.stringify({ trigger })}::jsonb
       WHERE NOT EXISTS (SELECT 1 FROM jobs WHERE user_id = ${userId} AND type = 'generate_roadmap' AND status = 'queued')
      ON CONFLICT (idempotency_key) DO NOTHING`);

    wakeWorker(`recompute:${trigger}`);
  } catch (err) {
    console.warn(`[triggerRecompute] non-blocking trigger error for user ${userId}:`, err);
  }
}
