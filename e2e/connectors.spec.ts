/**
 * Onboarding Step 5: connector cards settle without a reload once the worker
 * finishes, and LinkedIn asks for its scraping consent where it's used.
 */
import { expect, test, type Page } from "@playwright/test";

import { completeConnectorSync, countRows, createUser, signIn, sql } from "./support/fixtures";

const card = (page: Page, name: string) => page.getByRole("article", { name, exact: true });

test("connector cards: import status updates live; LinkedIn asks for consent in its dialog", async ({ page, context }) => {
  const user = await createUser("Asha Rao", "connectors");
  await signIn(context, user);
  await page.goto("/onboarding/connect-sources");

  await test.step("LeetCode: Importing, then Connected without a reload", async () => {
    await card(page, "LeetCode").getByRole("button", { name: "Connect LeetCode" }).click();
    await page.getByLabel("Username or profile link").fill("https://leetcode.com/u/asha_rao/");
    await page.getByRole("dialog").getByRole("button", { name: "Connect" }).click();

    const leetcode = card(page, "LeetCode");
    await expect(leetcode).toContainText("@asha_rao");
    await expect(leetcode).toContainText("Importing");
    await completeConnectorSync(user.id, "leetcode");
    await expect(leetcode).toContainText("Connected", { timeout: 20_000 });
    await expect(leetcode).toContainText("Last imported");
  });

  await test.step("LinkedIn: the dialog requires consent and records it", async () => {
    await card(page, "LinkedIn").getByRole("button", { name: "Connect LinkedIn" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Profile URL").fill("linkedin.com/in/asha-rao");
    await dialog.getByRole("button", { name: "Connect" }).click();
    await expect(dialog).toBeVisible(); // not submitted: consent box is required
    expect(await countRows("SELECT count(*) AS n FROM connections WHERE user_id = $1 AND source_id = 'linkedin'", [user.id])).toBe(0);

    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: "Connect" }).click();
    await expect(dialog).toBeHidden();
    expect(
      await countRows("SELECT count(*) AS n FROM consents WHERE user_id = $1 AND purpose = 'linkedin_scrape' AND granted", [user.id]),
    ).toBe(1);

    const linkedin = card(page, "LinkedIn");
    await expect(linkedin).toContainText("linkedin.com/in/asha-rao");
    await completeConnectorSync(user.id, "linkedin");
    await expect(linkedin).toContainText("Connected", { timeout: 20_000 });
  });

  await test.step("a LinkedIn import parked on consent offers 'Allow and import'", async () => {
    // As for connections made before the dialog asked: withdraw, then re-sync.
    await sql.query("INSERT INTO consents (user_id, purpose, granted, policy_version) SELECT $1, 'linkedin_scrape', false, policy_version FROM consents WHERE user_id = $1 LIMIT 1", [user.id]);
    await page.reload();

    const linkedin = card(page, "LinkedIn");
    await expect(linkedin).toContainText("Needs permission");
    await linkedin.getByRole("button", { name: "Allow and import" }).click();
    await expect(linkedin).toContainText("Importing");
    await completeConnectorSync(user.id, "linkedin");
    await expect(linkedin).toContainText("Connected", { timeout: 20_000 });
  });

  await test.step("Continue is enabled once a source is connected", async () => {
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page).toHaveURL(/\/onboarding\/review-consent$/);
  });
});
