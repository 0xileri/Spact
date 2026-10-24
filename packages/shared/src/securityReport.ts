import { z } from "zod";

/**
 * The Security Lab report: AGENTS.md section 10's attack cases, each with the test results that
 * back it. It is generated from test-runner output (packages/security-lab), never written by hand,
 * and the web page re-derives every status from the evidence instead of trusting the file.
 */

export const SECURITY_REPORT_SCHEMA = "spact.security-report.v1";

export const LAYERS = ["unit", "sandbox", "browser", "mcp", "notifier"] as const;
export type Layer = (typeof LAYERS)[number];

/** Layers whose tests run against a real local NEAR node and check chain state. */
export const CHAIN_LAYERS: ReadonlySet<Layer> = new Set(["sandbox", "browser", "mcp", "notifier"]);

export const CASE_STATUSES = ["PASSED_ON_CHAIN", "PASSED_UNIT_ONLY", "NOT_COVERED", "FAILED"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export interface Evidence {
  layer: Layer;
  suite: string;
  test: string;
  /** "missing" means the test did not appear in the runner's output at all. */
  result: "passed" | "failed" | "missing";
  duration_ms: number | null;
}

/** A case passes only if every test listed for it ran and passed; on chain if one of them is a chain test. */
export function deriveStatus(evidence: readonly Evidence[]): CaseStatus {
  if (evidence.length === 0) return "NOT_COVERED";
  if (evidence.some((e) => e.result !== "passed")) return "FAILED";
  return evidence.some((e) => CHAIN_LAYERS.has(e.layer)) ? "PASSED_ON_CHAIN" : "PASSED_UNIT_ONLY";
}

const text = (max: number) => z.string().min(1).max(max);
const httpsUrl = z
  .string()
  .max(300)
  .refine((s) => {
    try {
      return new URL(s).protocol === "https:";
    } catch {
      return false;
    }
  }, "not an https URL");
const sha256 = z.string().regex(/^[0-9a-f]{64}$/, "not a sha256 hex digest");
const count = z.number().int().nonnegative().max(100_000);

const evidenceSchema: z.ZodType<Evidence> = z.object({
  layer: z.enum(LAYERS),
  suite: text(64),
  test: text(300),
  result: z.enum(["passed", "failed", "missing"]),
  duration_ms: z.number().nonnegative().max(86_400_000).nullable(),
});

export const securityReportSchema = z.object({
  schema: z.literal(SECURITY_REPORT_SCHEMA),
  generated_at: z.iso.datetime(),
  source: z.object({
    kind: z.enum(["ci", "local"]),
    commit: z.string().regex(/^[0-9a-f]{40}$/).nullable(),
    commit_url: httpsUrl.nullable(),
    run_url: httpsUrl.nullable(),
    runner: text(200),
  }),
  toolchain: z.record(text(40), text(200)),
  suites: z
    .array(
      z.object({
        id: text(64),
        layer: z.enum(LAYERS),
        input: text(100),
        /** sha256 of the raw runner output this suite was read from; null when that file was missing. */
        sha256: sha256.nullable(),
        passed: count,
        failed: count,
        skipped: count,
        rerun: text(200),
      }),
    )
    .max(50),
  cases: z
    .array(
      z.object({
        id: z.string().regex(/^T\d{2}$/),
        attack: text(300),
        expected: text(300),
        status: z.enum(CASE_STATUSES),
        note: text(400).nullable(),
        evidence: z.array(evidenceSchema).max(40),
      }),
    )
    .max(40),
});
export type SecurityReport = z.infer<typeof securityReportSchema>;
