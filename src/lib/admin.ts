import "server-only";

import { notFound } from "next/navigation";

import type { User } from "@/db/schema";
import { isAdminEmail } from "@/lib/admin-emails";
import { getCurrentUser } from "@/lib/dal";

/**
 * Operators: users.is_admin, or an email in ADMIN_EMAILS (see admin-emails.ts).
 * Sign-in proves the email: magic links and Google/LinkedIn both verify it.
 * The proxy already 404s non-admins on /admin (session claim); this is the
 * second check, against the database.
 */
export const isAdmin = (user: Pick<User, "isAdmin" | "email">) => user.isAdmin || isAdminEmail(user.email);

/** Admin pages and actions. Signed out → /login (via getCurrentUser); signed in but not an admin → 404, so the page isn't advertised. */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!isAdmin(user)) notFound();
  return user;
}
