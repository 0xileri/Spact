import { expect, test } from "@playwright/test";

import { REPORT } from "./report.ts";

// The site as CI publishes it to GitHub Pages (built and served by e2e/global-setup.ts): a
// production build under /Spact/ with no vault configured.
const PAGES = "http://127.0.0.1:5198/Spact/";

test("the published site works under its subpath with no vault: the Security Lab loads, the rest says why it cannot", async ({ page }) => {
  const outside: string[] = [];
  const broken: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).host !== "127.0.0.1:5198") outside.push(r.url());
  });
  page.on("requestfailed", (r) => broken.push(r.url()));
  page.on("response", (r) => {
    if (r.status() >= 400) broken.push(`${r.status()} ${r.url()}`);
  });
  await page.route(`${PAGES}security-report.json`, (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(REPORT) }));

  await page.goto(PAGES);
  await expect(page.getByText("No vault is connected to this site yet")).toBeVisible();
  await expect(page.getByText("No vault connected")).toBeVisible();
  await expect(page.getByTestId("connect")).toHaveCount(0);

  await page.getByRole("link", { name: "Open the Security Lab" }).click();
  await expect(page).toHaveURL(`${PAGES}?page=security`);
  await expect(page.locator('[data-case="T01"]')).toHaveAttribute("data-status", "PASSED_ON_CHAIN");

  await page.getByRole("link", { name: "Overview" }).click();
  await expect(page).toHaveURL(PAGES);

  // an approval link loads nothing on a site that has no vault
  await page.goto(`${PAGES}?request=demo-approve-1&vault=vault.testnet`);
  await expect(page.getByText("No vault is connected to this site yet")).toBeVisible();
  await expect(page.getByRole("button")).toHaveCount(0);

  // styles and scripts all came from under the subpath, and nothing reached an RPC or wallet host
  expect(broken).toEqual([]);
  expect(outside).toEqual([]);
});

test("inside a frame, neither the vault site nor the published site draws anything to click", async ({ page }) => {
  for (const url of ["http://127.0.0.1:5199/?request=demo-approve-1", `${PAGES}?page=security`]) {
    await page.setContent(`<iframe src="${url}" width="900" height="600"></iframe>`);
    const frame = page.frameLocator("iframe");
    await expect(frame.getByTestId("framed")).toBeVisible();
    await expect(frame.getByRole("button")).toHaveCount(0);
    await expect(frame.getByRole("link")).toHaveText(["Open Spact in a new tab"]);
  }
});
