import { expect, test } from "@playwright/test";

import { formatUnits } from "@spact/shared";

import { chain, fixture, UNIT } from "./chain.ts";
import { REPORT } from "./report.ts";

const f = fixture();
const near = chain(f);
const tusd = (units: bigint | string) => `${formatUnits(BigInt(units), 6)} TUSD`;

test("the landing page states the vault's own limits and shows what is on chain", async ({ page }) => {
  await page.route("**/security-report.json", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(REPORT) }));
  await near.agentRequests("e2e-landing", 1n * UNIT, f.api_id, "Landing page check");
  const [policy, vaultBalance, budget] = await Promise.all([near.policy(), near.balance(f.vault_id), near.budget()]);

  await page.goto("/");
  await expect(page.getByTestId("landing")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Human rules.");

  // the three outcomes, in this vault's numbers as read from its policy
  await expect(page.getByTestId("rule-paid")).toHaveText(`Up to ${tusd(policy.auto_limit)}`);
  await expect(page.getByTestId("rule-waits")).toHaveText(`Over ${tusd(policy.auto_limit)}, up to ${tusd(policy.hard_tx_limit)}`);
  await expect(page.getByTestId("rule-blocked")).toHaveText(
    `Over ${tusd(policy.hard_tx_limit)}, past the ${tusd(policy.daily_limit)} daily budget, or to a payee not on the list`,
  );

  // live numbers match the chain
  await expect(page.getByTestId("live-balance")).toHaveText(tusd(vaultBalance));
  await expect(page.getByTestId("live-spent")).toContainText(`of ${tusd(budget.daily_limit)}`);
  const newest = page.getByTestId("live-recent").getByRole("listitem").first();
  await expect(newest).toContainText("1 TUSD to api.test.near");
  await expect(newest).toContainText("e2e-landing");
  await expect(newest).toContainText("Paid");
  await expect(page.getByTestId("lab-teaser-counts")).toContainText("1 pass on a local NEAR chain, 1 in unit tests only, 1 not covered yet");

  await page.getByRole("link", { name: "Open the dashboard" }).first().click();
  await expect(page).toHaveURL(/\?page=overview$/);
  await expect(page.getByTestId("dashboard")).toBeVisible();
  await page.getByRole("link", { name: "Spact home" }).click();
  await expect(page.getByTestId("landing")).toBeVisible();
});

test("on a phone the landing page fits the screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByTestId("live-balance")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
