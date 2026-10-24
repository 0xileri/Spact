import { SECURITY_REPORT_SCHEMA, type SecurityReport } from "@spact/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { loadSecurityReport, viewOf } from "../src/securityLab.js";

const chain = { layer: "sandbox" as const, suite: "rust:sandbox", test: "t16_callback_cannot_be_called_from_outside", result: "passed" as const, duration_ms: null };
const unit = { layer: "unit" as const, suite: "rust:spact_vault", test: "tests::t10_reservation_stays_on_its_original_day", result: "passed" as const, duration_ms: null };

const REPORT: SecurityReport = {
  schema: SECURITY_REPORT_SCHEMA,
  generated_at: "2026-10-24T16:58:00.000Z",
  source: { kind: "local", commit: "eb1ed44e93b0a46a6a1f3435b70973f0ec8a4916", commit_url: null, run_url: null, runner: "local run on linux x64" },
  toolchain: { node: "v22.22.0" },
  suites: [{ id: "rust:sandbox", layer: "sandbox", input: "cargo.txt", sha256: "a".repeat(64), passed: 10, failed: 0, skipped: 0, rerun: "scripts/test-contracts.sh" }],
  cases: [
    { id: "T16", attack: "a", expected: "e", status: "PASSED_ON_CHAIN", note: null, evidence: [chain] },
    { id: "T10", attack: "a", expected: "e", status: "PASSED_UNIT_ONLY", note: null, evidence: [unit] },
    { id: "T13", attack: "a", expected: "e", status: "NOT_COVERED", note: "P1", evidence: [] },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe("viewOf", () => {
  it("recomputes every status from the evidence and counts them", () => {
    const view = viewOf(REPORT);
    expect(view.cases.map((c) => [c.id, c.derived, c.mismatch])).toEqual([
      ["T16", "PASSED_ON_CHAIN", false],
      ["T10", "PASSED_UNIT_ONLY", false],
      ["T13", "NOT_COVERED", false],
    ]);
    expect(view.counts).toEqual({ PASSED_ON_CHAIN: 1, PASSED_UNIT_ONLY: 1, NOT_COVERED: 1, FAILED: 0 });
    expect(view.testsRun).toBe(10);
  });

  it("does not believe a verdict that its own evidence contradicts", () => {
    const edited = { ...REPORT, cases: [{ ...REPORT.cases[0], evidence: [{ ...chain, result: "failed" as const }] } as SecurityReport["cases"][number]] };
    const [c] = viewOf(edited).cases;
    expect(c).toMatchObject({ status: "PASSED_ON_CHAIN", derived: "FAILED", mismatch: true });
    // unit tests alone never count as on chain
    const upgraded = { ...REPORT, cases: [{ ...REPORT.cases[1], status: "PASSED_ON_CHAIN" } as SecurityReport["cases"][number]] };
    expect(viewOf(upgraded).cases[0]).toMatchObject({ derived: "PASSED_UNIT_ONLY", mismatch: true });
  });
});

describe("loadSecurityReport", () => {
  const serve = (status: number, body: string) => vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status })));

  it("reads a valid report, and says plainly when there is none or it is broken", async () => {
    serve(200, JSON.stringify(REPORT));
    expect((await loadSecurityReport("security-report.json")).kind).toBe("ok");
    serve(404, "not found");
    expect(await loadSecurityReport("security-report.json")).toEqual({ kind: "missing" });
    serve(200, "{nope");
    expect(await loadSecurityReport("security-report.json")).toEqual({ kind: "invalid", reason: "the file is not JSON" });
    serve(200, JSON.stringify({ ...REPORT, source: { ...REPORT.source, run_url: "javascript:alert(1)" } }));
    expect((await loadSecurityReport("security-report.json")).kind).toBe("invalid");
    serve(200, JSON.stringify({ ...REPORT, schema: "spact.security-report.v2" }));
    expect((await loadSecurityReport("security-report.json")).kind).toBe("invalid");
  });
});
