import { createHash } from "node:crypto";

import { deriveStatus, SECURITY_REPORT_SCHEMA, securityReportSchema, type Evidence, type SecurityReport } from "@spact/shared";

import { CASES, SUITES, type CatalogCase, type SuiteDef } from "./catalog.js";
import { parseCargo, parsePlaywright, parseVitest, type TestResult } from "./parse.js";

export interface BuildOptions {
  now: Date;
  source: SecurityReport["source"];
  toolchain: Record<string, string>;
  suites?: readonly SuiteDef[];
  cases?: readonly CatalogCase[];
}

export interface BuildResult {
  report: SecurityReport;
  /** Anything that makes this run unfit to publish as passing: failed or missing tests, unreadable inputs. */
  problems: string[];
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function parseInput(format: SuiteDef["format"], content: string, suite: string): TestResult[] {
  if (format === "cargo") return parseCargo(content);
  const json: unknown = JSON.parse(content);
  return format === "vitest" ? parseVitest(json, suite) : parsePlaywright(json, suite);
}

/**
 * Builds the report from raw runner output. `files` maps an input name (e.g. "cargo.txt") to its
 * content; a suite whose file is absent counts as not run.
 */
export function buildReport(files: ReadonlyMap<string, string>, options: BuildOptions): BuildResult {
  const suites = options.suites ?? SUITES;
  const cases = options.cases ?? CASES;
  const problems: string[] = [];
  const results = new Map<string, TestResult>();
  const readable = new Set<string>();

  for (const suite of suites) {
    const content = files.get(suite.input);
    if (content === undefined) continue;
    try {
      const parsed = parseInput(suite.format, content, suite.id).filter((r) => r.suite === suite.id);
      for (const r of parsed) results.set(`${r.suite}\u0000${r.name}`, r);
      readable.add(suite.input);
    } catch (e) {
      problems.push(`${suite.input}: cannot read it (${e instanceof Error ? e.message.slice(0, 200) : String(e)})`);
    }
  }

  const suiteRows = suites.map((suite) => {
    const own = [...results.values()].filter((r) => r.suite === suite.id);
    const row = {
      id: suite.id,
      layer: suite.layer,
      input: suite.input,
      sha256: readable.has(suite.input) ? sha256(files.get(suite.input) ?? "") : null,
      passed: own.filter((r) => r.result === "passed").length,
      failed: own.filter((r) => r.result === "failed").length,
      skipped: own.filter((r) => r.result === "skipped").length,
      rerun: suite.rerun,
    };
    if (row.sha256 === null) problems.push(`${suite.id}: no output (${suite.input} is missing or unreadable)`);
    else if (own.length === 0) problems.push(`${suite.id}: ${suite.input} has no tests for this suite`);
    if (row.failed > 0) problems.push(`${suite.id}: ${row.failed} test(s) failed`);
    return row;
  });

  const layerOf = new Map(suites.map((s) => [s.id, s.layer]));
  const caseRows = cases.map((c) => {
    const evidence: Evidence[] = c.tests.map(([suite, test]) => {
      const r = results.get(`${suite}\u0000${test}`);
      const layer = layerOf.get(suite);
      if (!layer) throw new Error(`${c.id}: unknown suite ${suite}`);
      return {
        layer,
        suite,
        test,
        result: r?.result === "passed" ? "passed" : r?.result === "failed" ? "failed" : "missing",
        duration_ms: r?.durationMs ?? null,
      };
    });
    const status = deriveStatus(evidence);
    for (const e of evidence) if (e.result !== "passed") problems.push(`${c.id}: ${e.suite} "${e.test}" ${e.result}`);
    return { id: c.id, attack: c.attack, expected: c.expected, status, note: c.note ?? null, evidence };
  });

  const report = securityReportSchema.parse({
    schema: SECURITY_REPORT_SCHEMA,
    generated_at: options.now.toISOString(),
    source: options.source,
    toolchain: options.toolchain,
    suites: suiteRows,
    cases: caseRows,
  });
  return { report, problems: [...new Set(problems)] };
}
