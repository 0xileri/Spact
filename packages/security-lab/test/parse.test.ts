import { describe, expect, it } from "vitest";

import { parseCargo, parsePlaywright, parseVitest } from "../src/parse.js";

const CARGO = [
  "   Compiling spact-vault v0.1.0",
  "     Running unittests src/lib.rs (target/debug/deps/spact_vault-9b29d63b2c130414)",
  "",
  "running 3 tests",
  "test tests::t01_over_hard_cap_is_blocked_without_reservation ... ok",
  "test tests::t05_agent_cannot_withdraw - should panic ... ok",
  "test tests::broken ... FAILED",
  "test result: FAILED. 2 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.10s",
  "     Running tests/sandbox.rs (target/debug/deps/sandbox-8b3986b9a1d1ff02)",
  "test t16_callback_cannot_be_called_from_outside ... \u001b[32mok\u001b[0m",
  "test slow_one ... ignored, needs a node",
  "   Doc-tests spact_vault",
  "test src/lib.rs - doc (line 3) ... ok",
].join("\n");

describe("parseCargo", () => {
  it("groups tests by binary and reads every outcome", () => {
    expect(parseCargo(CARGO)).toEqual([
      { suite: "rust:spact_vault", name: "tests::t01_over_hard_cap_is_blocked_without_reservation", result: "passed", durationMs: null },
      { suite: "rust:spact_vault", name: "tests::t05_agent_cannot_withdraw", result: "passed", durationMs: null },
      { suite: "rust:spact_vault", name: "tests::broken", result: "failed", durationMs: null },
      { suite: "rust:sandbox", name: "t16_callback_cannot_be_called_from_outside", result: "passed", durationMs: null },
      { suite: "rust:sandbox", name: "slow_one", result: "skipped", durationMs: null },
    ]);
  });

  it("refuses output where one test appears twice", () => {
    const twice = "     Running tests/sandbox.rs (target/debug/deps/sandbox-8b3986b9a1d1ff02)\ntest a ... ok\ntest a ... FAILED\n";
    expect(() => parseCargo(twice)).toThrow(/appears twice/);
  });
});

describe("parseVitest", () => {
  it("names tests by describe path and title, as vitest prints them", () => {
    const json = {
      testResults: [
        {
          name: "/repo/apps/mcp/test/tools.test.ts",
          assertionResults: [
            { ancestorTitles: ["request_payment"], title: "rejects malformed input", status: "passed", duration: 12 },
            { ancestorTitles: [], title: "top level", status: "failed", duration: 3 },
            { ancestorTitles: ["a", "b"], title: "skipped one", status: "skipped" },
          ],
        },
      ],
    };
    expect(parseVitest(json, "vitest:mcp")).toEqual([
      { suite: "vitest:mcp", name: "request_payment > rejects malformed input", result: "passed", durationMs: 12 },
      { suite: "vitest:mcp", name: "top level", result: "failed", durationMs: 3 },
      { suite: "vitest:mcp", name: "a > b > skipped one", result: "skipped", durationMs: null },
    ]);
    expect(() => parseVitest({ numTotalTests: 3 }, "vitest:mcp")).toThrow();
  });
});

describe("parsePlaywright", () => {
  it("walks file and describe suites and maps outcomes", () => {
    const json = {
      suites: [
        {
          title: "approval.spec.ts",
          specs: [
            { title: "owner approves", tests: [{ status: "expected", results: [{ duration: 4000 }] }] },
            { title: "owner rejects", tests: [{ status: "unexpected", results: [{ duration: 100 }, { duration: 90 }] }] },
          ],
          suites: [{ title: "nested", specs: [{ title: "later", tests: [{ status: "skipped", results: [] }] }] }],
        },
      ],
    };
    expect(parsePlaywright(json, "playwright:web")).toEqual([
      { suite: "playwright:web", name: "owner approves", result: "passed", durationMs: 4000 },
      { suite: "playwright:web", name: "owner rejects", result: "failed", durationMs: 90 },
      { suite: "playwright:web", name: "nested > later", result: "skipped", durationMs: null },
    ]);
  });
});
