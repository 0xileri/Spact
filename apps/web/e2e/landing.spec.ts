import { expect, test, type Page } from "@playwright/test";

import { formatUnits } from "@spact/shared";

import { chain, fixture } from "./chain.ts";
import { REPORT } from "./report.ts";

const f = fixture();
const near = chain(f);
const tusd = (units: bigint | string) => `${formatUnits(BigInt(units), 6)} TUSD`;

test("the landing page states the vault's own limits and shows what is on chain", async ({ page }) => {
  await page.route("**/security-report.json", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(REPORT) }));
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

  // the hero animation uses amounts picked from the same limits, and says so
  const gate = page.getByTestId("gate-flow");
  await expect(gate).toContainText(`≤ ${tusd(policy.auto_limit)} paid`);
  await expect(gate).toContainText(`> ${tusd(policy.hard_tx_limit)} blocked`);
  await expect(page.getByTestId("gate-source")).toHaveText(`Amounts picked from the limits of ${f.vault_id}, read from its policy.`);

  // live numbers match the chain
  await expect(page.getByTestId("live-balance")).toHaveText(tusd(vaultBalance));
  await expect(page.getByTestId("live-spent")).toContainText(`of ${tusd(budget.daily_limit)}`);
  await expect(page.getByTestId("hero-proof")).toContainText("1 of 3 attacks from the spec pass on a local NEAR chain, in CI.");

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

/** Opacity of each hero caption once every animation in the graphic is moved to `ms` into its cycle. */
async function captionsAt(page: Page, ms: number): Promise<number[]> {
  return page.getByTestId("gate-flow").evaluate((el, t) => {
    for (const a of el.getAnimations({ subtree: true })) {
      a.pause();
      a.currentTime = t;
    }
    return [...el.querySelectorAll(".gate-caption")].map((c) => Number(getComputedStyle(c).opacity));
  }, ms);
}

test("the hero animation plays its three requests in turn, and stops while off screen", async ({ page }) => {
  await page.goto("/");
  const gate = page.getByTestId("gate-flow");
  await expect(gate).toHaveAttribute("data-playing", "true");
  const running = () => gate.evaluate((el) => el.getAnimations({ subtree: true }).filter((a) => a.playState === "running").length);
  expect(await running()).toBeGreaterThan(20);

  // one caption at a time, in step with the request on screen: paid, then waiting, then blocked
  expect(await captionsAt(page, 1_000)).toEqual([1, 0, 0]);
  expect(await captionsAt(page, 5_000)).toEqual([0, 1, 0]);
  expect(await captionsAt(page, 8_500)).toEqual([0, 0, 1]);

  // below the fold, sections wait for the reader, then fade in
  const firstRule = page.getByTestId("outcomes").locator(".reveal").first();
  await expect(firstRule).toHaveAttribute("data-shown", "false");
  await page.getByTestId("live-balance").scrollIntoViewIfNeeded();
  await expect(firstRule).toHaveAttribute("data-shown", "true");
  await page.getByRole("contentinfo").scrollIntoViewIfNeeded();
  await expect(gate).toHaveAttribute("data-playing", "false");
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(gate).toHaveAttribute("data-playing", "true");
});

test("with reduced motion the hero is one still frame and everything is shown at once", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const gate = page.getByTestId("gate-flow");
  await expect(gate).toBeVisible();
  expect(await gate.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
  // the still frame is the request waiting for the wallet
  expect(await gate.evaluate((el) => [...el.querySelectorAll(".gate-caption")].map((c) => getComputedStyle(c).opacity))).toEqual(["0", "1", "0"]);
  await expect(page.locator(".reveal").first()).toHaveAttribute("data-shown", "true");
  await expect(page.locator('.reveal[data-shown="false"]')).toHaveCount(0);
});
