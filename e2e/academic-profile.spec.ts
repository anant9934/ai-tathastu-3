/**
 * Step 3's normalized academic profile: keyboard use of the institution
 * combobox, alias search, dependent degree fields, and "Other / Not listed"
 * creating a pending institution.
 */
import { expect, test } from "@playwright/test";

import { createUser, signIn, sql } from "./support/fixtures";

test("institution combobox: keyboard, aliases, dependent fields, Other / Not listed", async ({ page, context }) => {
  const user = await createUser("Kabir Singh", "basic_profile");
  await signIn(context, user);
  await page.goto("/onboarding/basic-profile");
  const box = page.getByRole("combobox", { name: "University or college" });

  await test.step("type an alias; arrows move, Escape closes without picking", async () => {
    await box.fill("LPU");
    const listbox = page.getByRole("listbox", { name: "Institutions" });
    await expect(listbox.getByRole("option").first()).toHaveText(/Lovely Professional University/);
    await expect(box).toHaveAttribute("aria-activedescendant", /.+/);
    await box.press("ArrowDown"); // to "Other / Not listed"
    await box.press("ArrowUp"); // back to LPU
    await box.press("Escape");
    await expect(listbox).toBeHidden();
    await expect(box).toHaveValue("");
    await expect(page.getByLabel("City")).toHaveValue("");
  });

  await test.step("Enter picks the highlighted result and fills the location", async () => {
    await box.fill("lpu");
    await expect(page.getByRole("option", { name: /Lovely Professional University/ })).toBeVisible();
    await box.press("Enter");
    await expect(box).toHaveValue("Lovely Professional University");
    await expect(page.getByLabel("City")).toHaveValue("Phagwara");
    await expect(page.getByLabel("State or province")).toHaveValue("Punjab");
  });

  await test.step("changing the degree resets dependent choices", async () => {
    await expect(page.getByRole("combobox", { name: "Specialization" })).toBeDisabled();
    await page.getByRole("combobox", { name: "Degree" }).click();
    await page.getByRole("option", { name: "B.Tech / B.E." }).click();
    await page.getByRole("combobox", { name: "Specialization" }).click();
    await page.getByRole("option", { name: "Civil Engineering" }).click();
    await page.getByRole("combobox", { name: "Current year" }).click();
    await expect(page.getByRole("option")).toHaveCount(4);
    await page.getByRole("option", { name: "4th year" }).click();

    await page.getByRole("combobox", { name: "Degree" }).click();
    await page.getByRole("option", { name: "M.Tech" }).click();
    await expect(page.getByRole("combobox", { name: "Specialization" })).toHaveText("Select a specialization");
    await expect(page.getByRole("combobox", { name: "Current year" })).toHaveText("Select your year");
    await page.getByRole("combobox", { name: "Specialization" }).click();
    await expect(page.getByRole("option", { name: "Civil Engineering" })).toHaveCount(0);
    await page.getByRole("option", { name: "VLSI Design" }).click();
    await page.getByRole("combobox", { name: "Current year" }).click();
    await expect(page.getByRole("option")).toHaveCount(2);
    await page.getByRole("option", { name: "1st year" }).click();
  });

  await test.step("no match → Other / Not listed → pending institution", async () => {
    // Click in first: a Radix Select returns focus to its trigger just after it closes.
    await box.click();
    await box.fill("Nowhere Institute of Things");
    await expect(page.getByText("No match for “Nowhere Institute of Things”.")).toBeVisible();
    await box.press("Enter"); // the only option: Other / Not listed
    await page.getByLabel("Institution name").fill("Nowhere Institute of Things");
    await expect(page.getByLabel("City")).not.toHaveAttribute("readonly");
    await page.getByLabel("City").fill("Ludhiana");
    await page.getByLabel("Country").fill("India");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page).toHaveURL(/\/onboarding\/resume$/);

    const row = (
      await sql.query(
        `SELECT i.canonical_name, i.verification_status, i.source, i.created_by = u.id AS mine, u.university, u.city, d.canonical_name AS degree, s.canonical_name AS spec
           FROM users u JOIN institutions i ON i.id = u.institution_id JOIN degrees d ON d.id = u.degree_id
           JOIN specializations s ON s.id = u.specialization_id WHERE u.id = $1`,
        [user.id],
      )
    ).rows[0];
    expect(row).toEqual({
      canonical_name: "Nowhere Institute of Things", verification_status: "pending", source: "user", mine: true,
      university: "Nowhere Institute of Things", city: "Ludhiana", degree: "M.Tech", spec: "VLSI Design",
    });
    const noResults = await sql.query("SELECT count(*)::int AS n FROM analytics_events WHERE event = 'search_no_results'");
    expect(noResults.rows[0].n).toBeGreaterThan(0);
  });

  await test.step("a pending institution isn't offered to other users", async () => {
    const other = await createUser("Second User", "basic_profile");
    await signIn(context, other);
    await page.goto("/onboarding/basic-profile");
    await page.getByRole("combobox", { name: "University or college" }).fill("Nowhere Institute");
    await expect(page.getByText("No match for “Nowhere Institute”.")).toBeVisible();
  });
});
