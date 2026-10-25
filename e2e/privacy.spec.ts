/**
 * /settings/privacy: an onboarded student changes a consent after onboarding;
 * each change appends a row, and faculty don't see the discovery switch.
 */
import { expect, test } from "@playwright/test";

import { createUser, signIn, sql } from "./support/fixtures";

const latest = async (userId: string, purpose: string) =>
  (
    await sql.query("SELECT granted FROM consents WHERE user_id = $1 AND purpose = $2 ORDER BY created_at DESC LIMIT 1", [userId, purpose])
  ).rows[0]?.granted;

test("privacy settings: toggles save as consent rows", async ({ browser }) => {
  const student = await createUser("Tara", "done");
  const context = await browser.newContext();
  await signIn(context, student, { onboarded: true });
  const page = await context.newPage();

  await page.goto("/settings/privacy");
  await expect(page.getByRole("heading", { name: "Your permissions" })).toBeVisible();
  const discovery = page.getByRole("switch", { name: "Let mentors and alumni find me" });
  await expect(discovery).not.toBeChecked();

  await discovery.click();
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  await expect.poll(() => latest(student.id, "mentor_discovery")).toBe(true);

  await discovery.click();
  await expect.poll(() => latest(student.id, "mentor_discovery")).toBe(false);

  await page.reload();
  await expect(page.getByRole("switch", { name: "Let mentors and alumni find me" })).not.toBeChecked();
  await context.close();

  const faculty = await createUser("Dr Iyer", "done");
  await sql.query("UPDATE users SET role = 'faculty' WHERE id = $1", [faculty.id]);
  const facultyContext = await browser.newContext();
  await signIn(facultyContext, faculty, { onboarded: true });
  const facultyPage = await facultyContext.newPage();
  await facultyPage.goto("/settings/privacy");
  await expect(facultyPage.getByRole("switch", { name: "Use AI services to read my resume" })).toBeVisible();
  await expect(facultyPage.getByRole("switch", { name: "Let mentors and alumni find me" })).toHaveCount(0);
  await facultyContext.close();
});
