// Client-safe view of a jobs row, as returned by GET /api/jobs/:id.

import type { JobStatus } from "@/db/schema";

export type JobView = {
  id: string;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  // Jobs queued ahead of this one; null unless status is queued.
  queuePosition: number | null;
  error: string | null;
  finishedAt: string | null;
  // Original upload name, from the job payload (resume jobs only).
  fileName: string | null;
};
