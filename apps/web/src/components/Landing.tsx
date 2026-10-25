import { useEffect, useState, type ReactNode } from "react";

import { explorerAccountLink, type AppConfig, type SiteConfig } from "../config.js";
import { usedPercent } from "../dashboard.js";
import { errorMessage, formatAmount, formatRelative } from "../format.js";
import { GENERIC_RULES, liveCounts, outcomeRules, type OutcomeRules } from "../landing.js";
import { loadDashboard, type DashboardSnapshot } from "../near/vault.js";
import { loadSecurityReport, type LoadResult } from "../securityLab.js";
import { SignalDot, type Signal } from "./Brand.js";
import { Card, Mono, Notice, StatusBadge } from "./ui.js";

/** Newest requests read for the live section. */
const READ = 50;

const NETWORK_NAME = { sandbox: "a local NEAR sandbox", testnet: "NEAR testnet", mainnet: "NEAR mainnet" } as const;

type Live = { kind: "none" } | { kind: "loading" } | { kind: "ok"; snapshot: DashboardSnapshot } | { kind: "error"; message: string };

function LinkButton({ href, children, variant = "primary", external = false }: { href: string; children: ReactNode; variant?: "primary" | "secondary" | "plain"; external?: boolean }) {
  const styles = {
    primary: "bg-ink text-paper hover:bg-slate-800",
    secondary: "bg-white text-ink ring-1 ring-slate-300 hover:bg-slate-50",
    plain: "text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-ink hover:decoration-slate-600",
  }[variant];
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
      className={`inline-flex items-center rounded-lg px-4 py-2.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${styles}`}
    >
      {children}
    </a>
  );
}

/** Inline code in prose: wraps between words, never inside an identifier. */
function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] break-words">{children}</code>;
}

function SectionTitle({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
      {children}
    </h2>
  );
}

const OUTCOMES: { signal: Signal; title: string; key: keyof OutcomeRules; after: string }[] = [
  { signal: "paid", title: "Paid at once", key: "paid", after: "The vault pays and records it. No one is asked." },
  { signal: "waits", title: "Waits for your wallet", key: "waits", after: "Stored until you approve the exact terms, or it expires." },
  { signal: "blocked", title: "Blocked", key: "blocked", after: "Refused on chain. Nothing is stored or sent." },
];

function OutcomesCard({ rules, caption }: { rules: OutcomeRules; caption: string }) {
  return (
    <Card className="p-0">
      <p className="border-b border-slate-100 px-5 py-3 text-xs font-medium tracking-wide text-slate-500 uppercase">When the agent asks to pay</p>
      <ul className="divide-y divide-slate-100" data-testid="outcomes">
        {OUTCOMES.map((o) => (
          <li key={o.signal} className="flex gap-3 px-5 py-4" data-outcome={o.signal}>
            <SignalDot signal={o.signal} className="mt-1.5" />
            <div className="min-w-0">
              <p className="font-display font-semibold">{o.title}</p>
              <p className="mt-0.5 text-sm text-slate-700" data-testid={`rule-${o.signal}`}>
                {rules[o.key]}
              </p>
              <p className="mt-1 text-xs text-slate-500">{o.after}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">{caption}</p>
    </Card>
  );
}

const STEPS = [
  {
    title: "Your agent asks",
    body: "From Claude Code or Codex, through two MCP tools. Its NEAR key can call two vault methods and nothing else, so it cannot move funds by itself.",
  },
  {
    title: "The vault decides, on chain",
    body: "Allowlisted payees, a cap per payment, an auto limit, and a daily budget that counts payments still in flight. The agent cannot change any of it.",
  },
  {
    title: "You approve the rest",
    body: "You see the exact terms and sign their hash in your wallet. If anything between you and the chain alters them, the vault rejects the approval.",
  },
];

function Stat({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <div className="mt-1 font-display text-2xl font-semibold" data-testid={testId}>
        {children}
      </div>
    </Card>
  );
}

function LiveSection({ config, live }: { config: AppConfig; live: Live }) {
  const vaultLink = explorerAccountLink(config, config.vaultId);
  const heading = <SectionTitle id="live">Live on {NETWORK_NAME[config.network]}</SectionTitle>;
  if (live.kind === "loading" || live.kind === "none") {
    return (
      <section className="space-y-4">
        {heading}
        <p className="text-sm text-slate-500">Reading the vault from the chain…</p>
      </section>
    );
  }
  if (live.kind === "error") {
    return (
      <section className="space-y-4">
        {heading}
        <Notice tone="warn" title="Could not read the vault right now">
          <p>{live.message}</p>
        </Notice>
      </section>
    );
  }

  const { snapshot } = live;
  const token = snapshot.tokens[0];
  const metadataFor = (id: string) => snapshot.tokens.find((t) => t.policy.token === id)?.metadata ?? null;
  const counts = liveCounts(snapshot.requests, snapshot.nowNs, snapshot.config.request_count);
  const recent = snapshot.requests.slice(0, 5);
  const budget = token?.budget && !token.budgetProblem ? token.budget : null;

  return (
    <section className="space-y-5" data-testid="live">
      <div>
        {heading}
        <p className="mt-2 text-sm text-slate-600">
          Read just now from <Mono>{config.vaultId}</Mono> over RPC. This page holds no keys.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="In the vault" testId="live-balance">
          {token && token.balance !== null ? formatAmount(token.balance.toString(), token.metadata) : "unknown"}
        </Stat>
        <Stat label="Spent today (UTC)" testId="live-spent">
          {budget && token ? (
            <>
              {formatAmount(budget.executed, token.metadata)}
              <span className="ml-1 text-sm font-normal text-slate-500">of {formatAmount(budget.daily_limit, token.metadata)}</span>
              <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                <span className="block h-full rounded-full bg-paid" style={{ width: `${usedPercent(budget)}%` }} />
              </span>
            </>
          ) : (
            "unknown"
          )}
        </Stat>
        <Stat label={counts.read < counts.stored ? `Paid, of the last ${counts.read}` : "Paid"} testId="live-paid">
          {counts.paid}
        </Stat>
        <Stat label="Waiting for the owner" testId="live-waiting">
          {counts.waiting}
        </Stat>
      </div>

      {recent.length > 0 ? (
        <Card className="p-0">
          <p className="border-b border-slate-100 px-5 py-3 text-xs font-medium tracking-wide text-slate-500 uppercase">Latest agent requests</p>
          <ul className="divide-y divide-slate-100" data-testid="live-recent">
            {recent.map((r) => (
              <li key={r.request_id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3 text-sm">
                <span className="min-w-0">
                  <span className="font-medium">{formatAmount(r.amount, metadataFor(r.token))}</span> to <Mono>{r.recipient}</Mono>
                  <span className="block text-xs text-slate-500">
                    {r.request_id} · {formatRelative(Number((BigInt(r.updated_at_ns) - snapshot.nowNs) / 1_000_000_000n))}
                  </span>
                </span>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <p className="text-xs text-slate-500">
        Blocked requests are refused before anything is stored, so they never appear in this list.
        {vaultLink ? (
          <>
            {" "}
            <a href={vaultLink} target="_blank" rel="noreferrer noopener" className="underline underline-offset-2">
              Every transaction on the explorer
            </a>
            .
          </>
        ) : null}
      </p>
      <LinkButton href="?page=overview" variant="secondary">
        Open the dashboard
      </LinkButton>
    </section>
  );
}

function LabSection({ lab }: { lab: LoadResult | null }) {
  const view = lab?.kind === "ok" ? lab.view : null;
  const examples = view ? view.cases.filter((c) => c.derived === "PASSED_ON_CHAIN").slice(0, 3) : [];
  return (
    <section className="space-y-4" data-testid="lab-teaser">
      <SectionTitle>Attacks it is tested against</SectionTitle>
      {view ? (
        <p className="max-w-3xl text-slate-700" data-testid="lab-teaser-counts">
          {view.cases.length} attacks from the spec, each tied to the tests that try it: {view.counts.PASSED_ON_CHAIN} pass on a local NEAR chain,{" "}
          {view.counts.PASSED_UNIT_ONLY} in unit tests only, {view.counts.NOT_COVERED} not covered yet
          {view.counts.FAILED > 0 ? `, ${view.counts.FAILED} failing` : ""}. The report is built by CI from the commit this site runs.
        </p>
      ) : (
        <p className="max-w-3xl text-slate-700">Each attack from the spec, tied to the tests that try it, with results built by CI.</p>
      )}
      {examples.length > 0 ? (
        <ul className="grid gap-3 md:grid-cols-3">
          {examples.map((c) => (
            <li key={c.id}>
              <Card className="h-full p-4">
                <p className="flex items-center gap-2 text-xs text-slate-500">
                  <SignalDot signal="paid" />
                  <span className="font-mono">{c.id}</span> passed on a local chain
                </p>
                <p className="mt-2 text-sm font-medium">{c.attack}</p>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}
      <LinkButton href="?page=security" variant="secondary">
        See every attack and its tests
      </LinkButton>
    </section>
  );
}

/** The public front page: what Spact is, how it decides, and what the configured vault is doing. */
export function Landing({ config }: { config: SiteConfig }) {
  const vaultConfig = config.vaultId === null ? null : config;
  const [live, setLive] = useState<Live>(vaultConfig ? { kind: "loading" } : { kind: "none" });
  const [lab, setLab] = useState<LoadResult | null>(null);

  useEffect(() => {
    if (!vaultConfig) return;
    let cancelled = false;
    loadDashboard(vaultConfig, READ).then(
      (snapshot) => !cancelled && setLive({ kind: "ok", snapshot }),
      (e: unknown) => !cancelled && setLive({ kind: "error", message: errorMessage(e) }),
    );
    return () => {
      cancelled = true;
    };
  }, [vaultConfig]);

  useEffect(() => {
    void loadSecurityReport(config.securityReportUrl).then(setLab);
  }, [config.securityReportUrl]);

  const token = live.kind === "ok" ? live.snapshot.tokens[0] : undefined;
  const rules = token ? outcomeRules(token.policy, token.metadata) : GENERIC_RULES;
  const caption =
    token && vaultConfig ? `These are the live limits of ${vaultConfig.vaultId}. Each owner sets their own.` : "Each owner sets their own numbers.";

  return (
    <div className="space-y-16 pb-4 sm:space-y-20" data-testid="landing">
      <section className="grid gap-10 pt-4 sm:pt-10 lg:grid-cols-[1.35fr_1fr] lg:items-center">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
            <SignalDot signal={vaultConfig ? "paid" : "waits"} className="h-1.5 w-1.5" />
            {vaultConfig ? `Live on ${NETWORK_NAME[vaultConfig.network]}` : "Unaudited hackathon prototype"}
          </p>
          <h1 className="mt-5 font-display text-4xl leading-[1.05] font-bold tracking-tight sm:text-6xl lg:text-5xl">
            Autonomous spending.
            <br />
            Human rules.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
            Spact is a spending firewall for AI agents on NEAR. Your agent asks a vault contract to pay. The contract checks your rules on chain:
            small payments go through, larger ones wait for your wallet, and the rest are blocked.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            {vaultConfig ? <LinkButton href="?page=overview">Open the dashboard</LinkButton> : null}
            <LinkButton href="?page=security" variant={vaultConfig ? "secondary" : "primary"}>
              See the Security Lab
            </LinkButton>
            {config.repoUrl ? (
              <LinkButton href={config.repoUrl} variant="plain" external>
                Source code
              </LinkButton>
            ) : null}
          </div>
        </div>
        <OutcomesCard rules={rules} caption={caption} />
      </section>

      <section className="space-y-6">
        <SectionTitle>How it works</SectionTitle>
        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <Card className="h-full">
                <p className="font-display text-sm font-semibold text-slate-400">0{i + 1}</p>
                <p className="mt-2 font-display text-lg font-semibold">{s.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.body}</p>
              </Card>
            </li>
          ))}
        </ol>
        <div className="rounded-xl bg-ink p-6 text-paper sm:p-8">
          <p className="font-display text-lg font-semibold">Why not just give the agent a wallet?</p>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
            A wallet key can spend everything. A NEAR function-call key limits which methods it can call, but its allowance caps gas, not money.
            Spact puts the money rules in a contract the agent cannot change, and every approval is bound to the exact payment you saw.
          </p>
        </div>
      </section>

      {vaultConfig ? (
        <LiveSection config={vaultConfig} live={live} />
      ) : (
        <section className="space-y-4">
          <SectionTitle>Live vault</SectionTitle>
          <Notice tone="info" title="No vault is connected to this site yet">
            <p>This build has no vault, so there is nothing live to show. The Security Lab works.</p>
          </Notice>
        </section>
      )}

      <LabSection lab={lab} />

      <section className="space-y-6">
        <SectionTitle>Try it</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <p className="font-display text-lg font-semibold">Run it on your machine</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              <Code>scripts/dev-sandbox.sh</Code> starts a local NEAR node, deploys a funded vault
              and opens this site with a test signer. No wallet or testnet needed.
            </p>
          </Card>
          <Card>
            <p className="font-display text-lg font-semibold">Connect your agent</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              <Code>apps/mcp</Code> gives Claude Code or Codex two tools, <Code>request_payment</Code> and <Code>get_payment_status</Code>, signed with a
              key that can only ask.
            </p>
          </Card>
        </div>
        {config.repoUrl ? (
          <LinkButton href={config.repoUrl} variant="secondary" external>
            Read the README
          </LinkButton>
        ) : null}
      </section>
    </div>
  );
}
