import { useEffect, useState, type ReactNode } from "react";

import type { CaseStatus, Layer } from "@spact/shared";

import { loadSecurityReport, type LabCase, type LoadResult } from "../securityLab.js";
import { Badge, Card, Mono, Notice } from "./ui.js";

const STATUS: Record<CaseStatus, { tone: "good" | "info" | "neutral" | "bad"; label: string }> = {
  PASSED_ON_CHAIN: { tone: "good", label: "Passed on a local chain" },
  PASSED_UNIT_ONLY: { tone: "info", label: "Passed in unit tests" },
  NOT_COVERED: { tone: "neutral", label: "Not covered" },
  FAILED: { tone: "bad", label: "Failed" },
};

const LAYER: Record<Layer, string> = {
  unit: "Unit test",
  sandbox: "Contract on chain",
  browser: "Browser on chain",
  mcp: "MCP tool on chain",
  notifier: "Telegram bot on chain",
};

function short(sha: string): string {
  return `${sha.slice(0, 12)}…`;
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className="underline decoration-stone-300 underline-offset-2 hover:decoration-stone-600">
      {children}
    </a>
  );
}

function CaseCard({ c }: { c: LabCase }) {
  const status = STATUS[c.derived];
  return (
    <li data-case={c.id} data-status={c.derived}>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="min-w-0 text-sm font-semibold text-stone-900">
            <span className="mr-2 font-mono text-stone-500">{c.id}</span>
            {c.attack}
          </h3>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <p className="mt-1 text-sm text-stone-600">
          <span className="text-stone-500">Expected:</span> {c.expected}
        </p>
        {c.mismatch ? (
          <div className="mt-3">
            <Notice tone="bad" title="This report contradicts itself">
              <p>
                The file says <Mono>{c.status}</Mono>, but its own test results say <Mono>{c.derived}</Mono>. This page shows the second.
              </p>
            </Notice>
          </div>
        ) : null}
        {c.note ? <p className="mt-2 text-xs leading-relaxed text-stone-500">{c.note}</p> : null}
        {c.evidence.length > 0 ? (
          <ul className="mt-3 space-y-2 border-t border-stone-100 pt-3 text-xs">
            {c.evidence.map((e) => (
              <li key={`${e.suite}:${e.test}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span
                  className={`font-semibold ${e.result === "passed" ? "text-emerald-700" : "text-rose-700"}`}
                  aria-label={e.result}
                >
                  {e.result === "passed" ? "✓ passed" : e.result === "failed" ? "✗ failed" : "✗ did not run"}
                </span>
                <Badge tone="neutral">{LAYER[e.layer]}</Badge>
                <Mono className="text-stone-700">{e.test}</Mono>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </li>
  );
}

/** The Security Lab: AGENTS.md section 10's attacks and the test results behind each one. */
export function SecurityLab({ reportUrl }: { reportUrl: string }) {
  const [result, setResult] = useState<LoadResult | null>(null);

  useEffect(() => {
    void loadSecurityReport(reportUrl).then(setResult);
  }, [reportUrl]);

  const intro = (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight">Security Lab</h1>
      <p className="mt-1 max-w-3xl text-sm leading-relaxed text-stone-600">
        Each row is an attack from the spec and the tests that try it. A row passes on a local chain only if every listed test ran and
        passed, and at least one of them checks real chain state on a local NEAR node. These tests use a throwaway sandbox chain and test
        tokens: no real funds move.
      </p>
    </div>
  );

  if (!result) return <div className="space-y-4">{intro}<p className="text-sm text-stone-500">Reading the report…</p></div>;
  if (result.kind === "missing") {
    return (
      <div className="space-y-4">
        {intro}
        <Notice tone="info" title="No Security Lab report here yet">
          <p>
            The report is built from real test runs, never written by hand. Run <Mono>scripts/security-report.sh</Mono> (or use the{" "}
            <Mono>security-report</Mono> artifact from CI) to create <Mono>security-report.json</Mono> next to this page.
          </p>
        </Notice>
      </div>
    );
  }
  if (result.kind === "invalid") {
    return (
      <div className="space-y-4">
        {intro}
        <Notice tone="bad" title="This is not a valid Spact security report">
          <p>{result.reason}. Nothing from it is shown.</p>
        </Notice>
      </div>
    );
  }

  const { report, cases, counts, testsRun, testsFailed } = result.view;
  const { source } = report;
  const reruns = [...new Set(report.suites.map((s) => s.rerun))];

  return (
    <div className="space-y-6" data-testid="security-lab">
      {intro}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="lab-summary">
        {(Object.keys(STATUS) as CaseStatus[]).map((s) => (
          <Card key={s} className="p-4">
            <p className="text-xs font-medium text-stone-500">{STATUS[s].label}</p>
            <p className="mt-1 font-display text-2xl font-semibold" data-testid={`count-${s}`}>
              {counts[s]}
              <span className="ml-1 text-xs font-normal text-stone-500">of {cases.length}</span>
            </p>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-stone-700">Where these results come from</h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-stone-500">Run</dt>
            <dd data-testid="lab-source">
              {source.kind === "ci" && source.run_url ? (
                <ExternalLink href={source.run_url}>CI run on GitHub Actions</ExternalLink>
              ) : (
                <span>
                  Local run, not from CI <Badge tone="warn">unverified</Badge>
                </span>
              )}
              <span className="block text-xs text-stone-500">{source.runner}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">Commit</dt>
            <dd>
              {source.commit ? (
                source.commit_url ? (
                  <ExternalLink href={source.commit_url}>
                    <Mono>{source.commit.slice(0, 12)}</Mono>
                  </ExternalLink>
                ) : (
                  <Mono>{source.commit.slice(0, 12)}</Mono>
                )
              ) : (
                "unknown"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">Generated</dt>
            <dd>{report.generated_at.replace("T", " ").replace(/\.\d+Z$/, " UTC").replace(/Z$/, " UTC")}</dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">Tests run</dt>
            <dd data-testid="lab-totals">
              {testsRun} in {report.suites.length} suites, {testsFailed} failed
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-stone-500">Toolchain</dt>
            <dd className="text-stone-700">
              {Object.entries(report.toolchain)
                .map(([k, v]) => `${k} ${v}`)
                .join(" · ")}
            </dd>
          </div>
        </dl>
        <div className="-mx-6 mt-4 overflow-x-auto border-t border-stone-100">
          <table className="w-full min-w-[34rem] text-left text-xs">
            <thead className="text-stone-500">
              <tr>
                <th className="px-6 py-2 font-medium">Suite</th>
                <th className="px-2 py-2 font-medium">Passed</th>
                <th className="px-2 py-2 font-medium">Failed</th>
                <th className="px-6 py-2 font-medium">sha256 of the raw output</th>
              </tr>
            </thead>
            <tbody>
              {report.suites.map((s) => (
                <tr key={s.id} className="border-t border-stone-50">
                  <td className="px-6 py-2 font-mono">{s.id}</td>
                  <td className="px-2 py-2">{s.passed}</td>
                  <td className={`px-2 py-2 ${s.failed > 0 ? "font-semibold text-rose-700" : ""}`}>{s.failed}</td>
                  <td className="px-6 py-2 font-mono" title={s.sha256 ?? undefined}>
                    {s.sha256 ? `${short(s.sha256)} (${s.input})` : `missing (${s.input})`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <ul className="space-y-3" data-testid="lab-cases">
        {cases.map((c) => (
          <CaseCard key={c.id} c={c} />
        ))}
      </ul>

      <Card>
        <h2 className="text-sm font-semibold text-stone-700">Run them yourself</h2>
        <p className="mt-1 text-sm text-stone-600">
          From a checkout of the repo, <Mono>scripts/security-report.sh</Mono> runs everything below and rebuilds this report. Each suite on its own:
        </p>
        <ul className="mt-2 space-y-1 text-sm">
          {reruns.map((r) => (
            <li key={r}>
              <Mono className="rounded bg-stone-100 px-2 py-0.5 text-xs">{r}</Mono>
            </li>
          ))}
        </ul>
      </Card>

      <p className="text-xs leading-relaxed text-stone-500">
        Unaudited hackathon prototype. Passing tests show that these attacks fail in these tests. They do not prove the system secure.
      </p>
    </div>
  );
}
