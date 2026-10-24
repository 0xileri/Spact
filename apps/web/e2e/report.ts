import { SECURITY_REPORT_SCHEMA, type SecurityReport } from "@spact/shared";

// A small Security Lab report for the browser tests. It is a fixture, not a real run.
export const RUN = "https://github.com/0xileri/Spact/actions/runs/123456";
export const evidence = (layer: "unit" | "sandbox" | "mcp", test: string, result: "passed" | "failed" | "missing" = "passed") => ({
  layer,
  suite: layer === "unit" ? "rust:spact_vault" : layer === "mcp" ? "vitest:mcp-sandbox" : "rust:sandbox",
  test,
  result,
  duration_ms: null,
});

export const REPORT: SecurityReport = {
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
