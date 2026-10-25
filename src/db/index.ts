import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { connectLocal, isLocalDatabase } from "./local";
import * as schema from "./schema";

const url = process.env.DATABASE_URL!;

// neon-http is one HTTP round trip per query, which suits serverless. It has
// no interactive transactions; use db.batch([...]) for atomic multi-writes.
// A localhost URL (E2E tests, a local Postgres) uses node-postgres instead.
export const db = isLocalDatabase(url) ? connectLocal(url, schema) : drizzle({ client: neon(url), schema });
