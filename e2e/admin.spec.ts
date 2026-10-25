/**
 * /admin/institutions: only admins can open it (others get a 404, signed-out
 * visitors the login page), and Approve / Merge / Reject do what they say.
 */
import { expect, test } from "@playwright/test";

import { createUser, signIn, sql } from "./support/fixtures";

async function pendingInstitution(name: string, ownerId: string) {
  const { rows } = await sql.query(
    `INSERT INTO institutions (canonical_name, city, country_code, verification_status, source, created_by)
     VALUES ($1, 'Ludhiana', NULL, 'pending', 'user', $2) RETURNING id`,
    [name, ownerId],
  );
  await sql.query("UPDATE users SET institution_id = $1, university = $2 WHERE id = $3", [rows[0].id, name, ownerId]);
  return rows[0].id as string;
}

const statusOf = async (id: string) =>
  (await sql.query("SELECT verification_status, merged_into IS NOT NULL AS merged FROM institutions WHERE id = $1", [id])).rows[0];
const userInst = async (id: string) =>
  (await sql.query("SELECT u.institution_id, u.university, u.city FROM users u WHERE u.id = $1", [id])).rows[0];

test("admin institutions: access control and Approve / Merge / Reject", async ({ browser }) => {
  const student1 = await createUser("Kabir", "done");
  const student2 = await createUser("Meher", "done");
  const student3 = await createUser("Ravi", "done");
  const approveId = await pendingInstitution("Punjab Institute of Data Science", student1.id);
  const mergeId = await pendingInstitution("IIT Madras Chennai campus", student2.id);
  const rejectId = await pendingInstitution("asdf qwerty", student3.id);

  await test.step("signed out → login; non-admin → 404", async () => {
    const anon = await browser.newContext();
    const anonPage = await anon.newPage();
    await anonPage.goto("/admin/institutions");
    await expect(anonPage).toHaveURL(/\/login/);
    await anon.close();

    const student = await browser.newContext();
    await signIn(student, student1, { onboarded: true });
    const studentPage = await student.newPage();
    const res = await studentPage.goto("/admin/institutions");
    expect(res?.status()).toBe(404);
    await expect(studentPage.getByRole("heading", { name: "Pending institutions" })).toHaveCount(0);
    await student.close();
  });

  // A fresh context: clearCookies() + a new cookie on the same one wasn't reliable in CI.
  await sql.query("DELETE FROM users WHERE email = 'admin@e2e.test'"); // a retry reuses the stack
  const admin = await createUser("Ops Admin", "done", "admin@e2e.test");
  const context = await browser.newContext();
  await signIn(context, admin, { onboarded: true });
  const page = await context.newPage();

  await test.step("admin sees the pending table", async () => {
    await page.goto("/admin/institutions");
    await expect(page.getByRole("heading", { name: "Pending institutions" })).toBeVisible();
    for (const name of ["Punjab Institute of Data Science", "IIT Madras Chennai campus", "asdf qwerty"]) {
      await expect(page.getByRole("rowheader", { name: new RegExp(name) })).toBeVisible();
    }
  });

  await test.step("Approve: verified and searchable", async () => {
    await page.getByRole("button", { name: "Approve Punjab Institute of Data Science" }).click();
    await expect(page.getByRole("rowheader", { name: /Punjab Institute of Data Science/ })).toHaveCount(0);
    expect(await statusOf(approveId)).toEqual({ verification_status: "verified", merged: false });
  });

  await test.step("Merge: users move to the chosen institution", async () => {
    await page.getByRole("button", { name: "Merge IIT Madras Chennai campus" }).click();
    const box = page.getByRole("combobox", { name: "Merge into" });
    await box.fill("IIT Madras");
    await expect(page.getByRole("option", { name: /Indian Institute of Technology Madras/ })).toBeVisible();
    await box.press("Enter");
    await page.getByRole("button", { name: "Merge 1 user" }).click();
    await expect(page.getByRole("rowheader", { name: /IIT Madras Chennai campus/ })).toHaveCount(0);
    expect(await statusOf(mergeId)).toEqual({ verification_status: "merged", merged: true });
    expect(await userInst(student2.id)).toMatchObject({ university: "Indian Institute of Technology Madras", city: "Chennai" });
  });

  await test.step("Reject: users unlinked, their text kept", async () => {
    await page.getByRole("button", { name: "Reject asdf qwerty" }).click();
    // Other specs may leave their own pending entries; this one must be gone.
    await expect(page.getByRole("rowheader", { name: /asdf qwerty/ })).toHaveCount(0);
    expect(await statusOf(rejectId)).toEqual({ verification_status: "rejected", merged: false });
    expect(await userInst(student3.id)).toEqual({ institution_id: null, university: "asdf qwerty", city: null });
  });
});
