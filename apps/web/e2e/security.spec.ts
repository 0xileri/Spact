import { expect, test, type Page } from "@playwright/test";

import { SECURITY_REPORT_SCHEMA, type SecurityReport } from "@spact/shared";

const RUN = "https://github.com/0xileri/Spact/actions/runs/123456";
const evidence = (layer: "unit" | "sandbox" | "mcp", test: string, result: "passed" | "failed" | "missing" = "passed") => ({
  layer,
  suite: layer === "unit" ? "rust:spact_vault" : layer === "mcp" ? "vitest:mcp-sandbox" : "rust:sandbox",
  test,
  result,
  duration_ms: null,
});

const REPORT: SecurityReport = {
  schema: SECURITY_REPORT_SCHEMA,
  generated_at: "2026-10-24T16:58:00.000Z",
  source: {
    kind: "ci",
    commit: "eb1ed44e93b0a46a6a1f3435b70973f0ec8a4916",
    commit_url: "https://github.com/0xileri/Spact/commit/eb1ed44e93b0a46a6a1f3435b70973f0ec8a4916",
    run_url: RUN,
    runner: "GitHub Actions, Linux X64",
  },
  toolchain: { node: "v22.22.0", rustc: "rustc 1.97.0" },
  suites: [
    { id: "rust:sandbox", layer: "sandbox", input: "cargo.txt", sha256: "a".repeat(64), passed: 10, failed: 0, skipped: 0, rerun: "scripts/test-contracts.sh" },
    { id: "vitest:mcp-sandbox", layer: "mcp", input: "vitest-mcp-sandbox.json", sha256: "b".repeat(64), passed: 11, failed: 0, skipped: 0, rerun: "pnpm mcp:sandbox" },
  ],
  cases: [
    {
      id: "T01",
      attack: "The agent asks for more than the per-payment hard cap.",
      expected: "BLOCKED; nothing is reserved or paid.",
      status: "PASSED_ON_CHAIN",
      note: null,
      evidence: [
        evidence("unit", "tests::t01_over_hard_cap_is_blocked_without_reservation"),
        evidence("mcp", "Spact MCP server on a sandbox chain > is blocked above the hard cap, and nothing is stored or paid"),
      ],
    },
    {
      id: "T10",
      attack: "A reservation is open across UTC midnight.",
      expected: "It stays on its original day.",
      status: "PASSED_UNIT_ONLY",
      note: "Unit test with a mocked clock.",
      evidence: [evidence("unit", "tests::t10_reservation_stays_on_its_original_day")],
    },
    { id: "T13", attack: "A refund that never arrived.", expected: "Not credited.", status: "NOT_COVERED", note: "P1: no cross-chain route.", evidence: [] },
  ],
};

async function serveReport(page: Page, body: string, status = 200) {
  await page.route("**/security-report.json", (route) => route.fulfill({ status, contentType: "application/json", body }));
}

test("the Security Lab shows each attack, the tests behind it, and where the results come from", async ({ page }) => {
  await serveReport(page, JSON.stringify(REPORT));
  await page.goto("/");
  await page.getByRole("link", { name: "Security Lab" }).click();

  await expect(page.getByTestId("security-lab")).toBeVisible();
  await expect(page.getByTestId("lab-source").getByRole("link", { name: "CI run on GitHub Actions" })).toHaveAttribute("href", RUN);
  await expect(page.getByTestId("lab-totals")).toHaveText("21 in 2 suites, 0 failed");
  await expect(page.getByTestId("count-PASSED_ON_CHAIN")).toContainText("1");
  await expect(page.getByTestId("count-NOT_COVERED")).toContainText("1");

  const t01 = page.locator('[data-case="T01"]');
  await expect(t01).toHaveAttribute("data-status", "PASSED_ON_CHAIN");
  await expect(t01).toContainText("Passed on a local chain");
  await expect(t01).toContainText("MCP tool on chain");
  await expect(t01).toContainText("is blocked above the hard cap, and nothing is stored or paid");
  await expect(page.locator('[data-case="T10"]')).toContainText("Passed in unit tests");
  await expect(page.locator('[data-case="T13"]')).toContainText("P1: no cross-chain route.");
  await expect(page.getByText("pnpm mcp:sandbox")).toBeVisible();
});

test("a report that contradicts its own evidence is not believed", async ({ page }) => {
  const [first, ...rest] = REPORT.cases;
  const edited = { ...REPORT, cases: [{ ...first, evidence: [evidence("mcp", "Spact MCP server on a sandbox chain > is blocked above the hard cap, and nothing is stored or paid", "failed")] }, ...rest] };
  await serveReport(page, JSON.stringify(edited));
  await page.goto("/?page=security");

  const t01 = page.locator('[data-case="T01"]');
  await expect(t01).toHaveAttribute("data-status", "FAILED");
  await expect(t01).toContainText("This report contradicts itself");
  await expect(t01).toContainText("failed");
});

test("a missing or broken report is reported as such", async ({ page }) => {
  await serveReport(page, "not found", 404);
  await page.goto("/?page=security");
  await expect(page.getByText("No Security Lab report here yet")).toBeVisible();

  await page.unrouteAll();
  await serveReport(page, JSON.stringify({ ...REPORT, schema: "something-else" }));
  await page.reload();
  await expect(page.getByText("This is not a valid Spact security report")).toBeVisible();
  await expect(page.getByTestId("security-lab")).toHaveCount(0);
});
