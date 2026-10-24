import { deriveStatus, securityReportSchema, type CaseStatus, type SecurityReport } from "@spact/shared";

export type LabCase = SecurityReport["cases"][number] & {
  /** The status recomputed from this case's own evidence; the page shows this one. */
  derived: CaseStatus;
  /** The file's status disagrees with its evidence: the report was edited or is broken. */
  mismatch: boolean;
};

export interface LabView {
  report: SecurityReport;
  cases: LabCase[];
  counts: Record<CaseStatus, number>;
  testsRun: number;
  testsFailed: number;
}

export type LoadResult = { kind: "ok"; view: LabView } | { kind: "missing" } | { kind: "invalid"; reason: string };

/** Never trusts the file's own verdicts: every status is recomputed from the listed evidence. */
export function viewOf(report: SecurityReport): LabView {
  const counts: Record<CaseStatus, number> = { PASSED_ON_CHAIN: 0, PASSED_UNIT_ONLY: 0, NOT_COVERED: 0, FAILED: 0 };
  const cases = report.cases.map((c) => {
    const derived = deriveStatus(c.evidence);
    counts[derived] += 1;
    return { ...c, derived, mismatch: derived !== c.status };
  });
  return {
    report,
    cases,
    counts,
    testsRun: report.suites.reduce((n, s) => n + s.passed + s.failed, 0),
    testsFailed: report.suites.reduce((n, s) => n + s.failed, 0),
  };
}

export async function loadSecurityReport(url: string): Promise<LoadResult> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch {
    return { kind: "invalid", reason: "the report could not be fetched" };
  }
  if (res.status === 404) return { kind: "missing" };
  if (!res.ok) return { kind: "invalid", reason: `HTTP ${res.status}` };
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { kind: "invalid", reason: "the file is not JSON" };
  }
  const parsed = securityReportSchema.safeParse(json);
  if (!parsed.success) return { kind: "invalid", reason: "the file is not a Spact security report (v1)" };
  return { kind: "ok", view: viewOf(parsed.data) };
}
