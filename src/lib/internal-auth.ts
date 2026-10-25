import "server-only";

import { timingSafeEqual } from "node:crypto";

/** Constant-time string comparison; false for empty or different-length values. */
export function safeEqual(given: string | null | undefined, expected: string | null | undefined) {
  if (!given || !expected || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

const bearer = (header: string | null) => header?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;

/** Worker → app calls: Bearer INTERNAL_API_SECRET (at least 32 characters). */
export function isInternalCall(request: Request) {
  const secret = process.env.INTERNAL_API_SECRET ?? "";
  return secret.length >= 32 && safeEqual(bearer(request.headers.get("authorization")), secret);
}

/** Vercel Cron sends Bearer CRON_SECRET; the worker's secret is accepted too. */
export function isCronCall(request: Request) {
  const cron = process.env.CRON_SECRET ?? "";
  return isInternalCall(request) || (cron.length >= 16 && safeEqual(bearer(request.headers.get("authorization")), cron));
}
