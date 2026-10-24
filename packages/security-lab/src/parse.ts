/**
 * Readers for raw test-runner output. Each returns one result per test, keyed by the name the
 * runner prints, so the catalog can point at tests by name.
 */
import { z } from "zod";

export interface TestResult {
  suite: string;
  name: string;
  result: "passed" | "failed" | "skipped";
  durationMs: number | null;
}

export class ParseError extends Error {}

function add(results: Map<string, TestResult>, r: TestResult) {
  const key = `${r.suite}\u0000${r.name}`;
  if (results.has(key)) throw new ParseError(`${r.suite}: test "${r.name}" appears twice`);
  results.set(key, r);
}

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;]*m/g;

/**
 * `cargo test` (libtest) plain output. Tests are grouped by the binary named on each
 * "Running ... (target/debug/deps/<binary>-<hash>)" line; the suite is `rust:<binary>`.
 */
export function parseCargo(text: string): TestResult[] {
  const results = new Map<string, TestResult>();
  let binary: string | null = null;
  for (const raw of text.split("\n")) {
    const line = raw.replace(ANSI, "").trimEnd();
    const running = /^\s*Running .*\/deps\/([A-Za-z0-9_]+)-[0-9a-f]+\)$/.exec(line);
    if (running) {
      binary = running[1] ?? null;
      continue;
    }
    if (/^\s*Doc-tests /.test(line)) {
      binary = null;
      continue;
    }
    const test = /^test (.+?)(?: - should panic)? \.\.\. (ok|FAILED|ignored)\b/.exec(line);
    if (!test || binary === null) continue;
    const outcome = test[2];
    add(results, {
      suite: `rust:${binary}`,
      name: test[1] ?? "",
      result: outcome === "ok" ? "passed" : outcome === "FAILED" ? "failed" : "skipped",
      durationMs: null,
    });
  }
  return [...results.values()];
}

const vitestReport = z.object({
  testResults: z.array(
    z.object({
      name: z.string(),
      assertionResults: z.array(
        z.object({
          ancestorTitles: z.array(z.string()),
          title: z.string(),
          status: z.string(),
          duration: z.number().nullish(),
        }),
      ),
    }),
  ),
});

/** Vitest's JSON reporter. Names are the describe path and title joined with " > ", as vitest prints them. */
export function parseVitest(json: unknown, suite: string): TestResult[] {
  const report = vitestReport.parse(json);
  const results = new Map<string, TestResult>();
  for (const file of report.testResults) {
    for (const t of file.assertionResults) {
      add(results, {
        suite,
        name: [...t.ancestorTitles, t.title].join(" > "),
        result: t.status === "passed" ? "passed" : t.status === "failed" ? "failed" : "skipped",
        durationMs: t.duration ?? null,
      });
    }
  }
  return [...results.values()];
}

interface PwSpec {
  title: string;
  tests: { status: string; results: { duration: number }[] }[];
}
interface PwSuite {
  title: string;
  specs: PwSpec[];
  suites?: PwSuite[] | undefined;
}

const pwSuite: z.ZodType<PwSuite> = z.lazy(() =>
  z.object({
    title: z.string(),
    specs: z.array(
      z.object({
        title: z.string(),
        tests: z.array(z.object({ status: z.string(), results: z.array(z.object({ duration: z.number() })) })),
      }),
    ),
    suites: z.array(pwSuite).optional(),
  }),
);
const pwReport = z.object({ suites: z.array(pwSuite) });

/**
 * Playwright's JSON reporter. The top-level suites are files; names are the describe path and
 * test title joined with " > ". A test passes if Playwright counts its outcome as expected
 * (retries are off in this repo, so "flaky" does not occur).
 */
export function parsePlaywright(json: unknown, suite: string): TestResult[] {
  const results = new Map<string, TestResult>();
  const walk = (s: PwSuite, path: string[]) => {
    for (const spec of s.specs) {
      for (const t of spec.tests) {
        add(results, {
          suite,
          name: [...path, spec.title].join(" > "),
          result: t.status === "expected" || t.status === "flaky" ? "passed" : t.status === "skipped" ? "skipped" : "failed",
          durationMs: t.results.at(-1)?.duration ?? null,
        });
      }
    }
    for (const child of s.suites ?? []) walk(child, [...path, child.title]);
  };
  for (const file of pwReport.parse(json).suites) walk(file, []);
  return [...results.values()];
}
