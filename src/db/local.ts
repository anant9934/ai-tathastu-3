import "server-only";

import { createRequire } from "node:module";
import path from "node:path";

import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

/** postgres://…@localhost or 127.0.0.1: a local Postgres, never Neon. */
export function isLocalDatabase(url: string | undefined) {
  return Boolean(url && /^postgres(ql)?:\/\/([^@/]*@)?(localhost|127\.0\.0\.1)[:/]/.test(url));
}

/**
 * node-postgres for a local database (the E2E stack's PGlite socket server, or
 * a Postgres in Docker). `pg` is a dev dependency loaded only on this path, so
 * production bundles never include it.
 *
 * Typed as the Neon client so callers keep one API. node-postgres has no
 * batch(); the shim runs the queries in order, which is enough for tests but
 * not atomic.
 */
export function connectLocal<S extends Record<string, unknown>>(url: string, schema: S): NeonHttpDatabase<S> {
  const load = createRequire(path.join(process.cwd(), "package.json"));
  const { Pool } = load("pg") as typeof import("pg");
  const { drizzle } = load("drizzle-orm/node-postgres") as typeof import("drizzle-orm/node-postgres");

  const db = drizzle({ client: new Pool({ connectionString: url, max: 4 }), schema }) as NodePgDatabase<S> & {
    batch?: (queries: PromiseLike<unknown>[]) => Promise<unknown[]>;
  };
  db.batch = async (queries) => {
    const results = [];
    for (const q of queries) results.push(await q);
    return results;
  };
  return db as unknown as NeonHttpDatabase<S>;
}
