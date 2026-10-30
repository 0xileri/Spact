import { ArrowRight } from "@phosphor-icons/react";
import { useEffect, useState, type ReactNode } from "react";

import { explorerAccountLink, type AppConfig, type SiteConfig } from "../config.js";
import { usedPercent } from "../dashboard.js";
import { errorMessage, formatAmount } from "../format.js";
import { GENERIC_GATE, GENERIC_RULES, gateExample, liveCounts, outcomeRules, type GateExample, type OutcomeRules } from "../landing.js";
import { loadDashboard, type DashboardSnapshot } from "../near/vault.js";
import { loadSecurityReport, type LoadResult } from "../securityLab.js";
import { SignalDot, type Signal } from "./Brand.js";
import { GateFlow } from "./GateFlow.js";
import { Reveal } from "./Motion.js";
import { OutcomeMotion } from "./OutcomeMotion.js";
import { Mono, Notice } from "./ui.js";

/** Newest requests read for the live counts. */
const READ = 50;

const NETWORK_NAME = { sandbox: "a local NEAR sandbox", testnet: "NEAR testnet", mainnet: "NEAR mainnet" } as const;

type Live = { kind: "none" } | { kind: "loading" } | { kind: "ok"; snapshot: DashboardSnapshot } | { kind: "error"; message: string };

function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-6xl px-6 ${className}`}>{children}</div>;
}

/** The page's one primary action style: ink, semibold, with an arrow. */
function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="group inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-base font-semibold text-white transition duration-300 ease-fluid hover:bg-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:translate-y-px"
    >
      {children}
      <ArrowRight size={16} weight="bold" aria-hidden="true" className="transition-transform duration-300 ease-fluid group-hover:translate-x-1" />
    </a>
  );
}

/** Secondary actions are text links, not a second button. */
function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1 text-base font-semibold text-ink underline decoration-zinc-300 underline-offset-4 transition-colors duration-300 ease-fluid hover:decoration-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {children}
    </a>
  );
}

function SectionTitle({ label, title, id, children }: { label: string; title: string; id: string; children?: ReactNode }) {
  return (
    <div className="max-w-2xl">
      <p className="font-mono text-xs text-zinc-500">{label}</p>
      <h2 id={id} className="mt-3 text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
        {title}
      </h2>
      {children ? <div className="mt-4 text-base leading-relaxed text-zinc-600">{children}</div> : null}
    </div>
  );
}

const OUTCOMES: { signal: Signal; title: string; key: keyof OutcomeRules; after: string }[] = [
  { signal: "paid", title: "Paid at once", key: "paid", after: "The vault pays and records it. Nobody is asked." },
  { signal: "waits", title: "Waits for your wallet", key: "waits", after: "Stored until you approve the exact terms, or until it expires." },
  { signal: "blocked", title: "Blocked", key: "blocked", after: "Refused on chain. Nothing is stored or sent." },
];

function Outcomes({ rules, caption, example }: { rules: OutcomeRules; caption: string; example: GateExample }) {
  return (
    <section className="py-24" aria-labelledby="outcomes-title">
      <Container>
        <Reveal>
          <SectionTitle label="The rules" title="Every request ends one of three ways." id="outcomes-title">
            <p>{caption}</p>
          </SectionTitle>
        </Reveal>
        <ul className="mt-12 grid grid-cols-1 gap-3 md:grid-cols-3" data-testid="outcomes">
          {OUTCOMES.map((o, i) => (
            <li key={o.signal} data-outcome={o.signal}>
              <Reveal delay={i * 90} className="h-full">
                <div className="h-full rounded-2xl border border-line bg-surface p-6">
                  <div className="rounded-xl border border-line bg-paper px-2 py-3">
                    <OutcomeMotion signal={o.signal} amount={example[o.signal]} />
                  </div>
                  <p className="mt-6 flex items-center gap-2 text-sm font-semibold">
                    <SignalDot signal={o.signal} />
                    {o.title}
                  </p>
                  <p className="mt-6 text-xl font-semibold text-ink" data-testid={`rule-${o.signal}`}>
                    {rules[o.key]}
                  </p>
                  <p className="mt-2 text-sm text-zinc-500">{o.after}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

function Stat({ label, children, testId }: { label: string; children: ReactNode; testId: string }) {
  return (
    <div className="h-full rounded-2xl border border-line bg-surface p-6">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <div className="mt-2 text-3xl font-semibold tracking-tight" data-testid={testId}>
        {children}
      </div>
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-6" aria-hidden="true">
      <div className="h-3 w-20 animate-pulse rounded bg-zinc-100" />
      <div className="mt-4 h-8 w-28 animate-pulse rounded bg-zinc-100" />
    </div>
  );
}

function LiveSection({ config, live }: { config: AppConfig; live: Live }) {
  const vaultLink = explorerAccountLink(config, config.vaultId);

  let body: ReactNode;
  if (live.kind === "error") {
    body = (
      <Notice tone="warn" title="Could not read the vault right now">
        <p>{live.message}</p>
      </Notice>
    );
  } else if (live.kind !== "ok") {
    body = (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Reading the vault from the chain">
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
      </div>
    );
  } else {
    const { snapshot } = live;
    const token = snapshot.tokens[0];
    const counts = liveCounts(snapshot.requests, snapshot.nowNs, snapshot.config.request_count);
    const budget = token?.budget && !token.budgetProblem ? token.budget : null;
    const stats: [string, string, ReactNode][] = [
      ["In the vault", "live-balance", token && token.balance !== null ? formatAmount(token.balance.toString(), token.metadata) : "unknown"],
      [
        "Spent today (UTC)",
        "live-spent",
        budget && token ? (
          <>
            {formatAmount(budget.executed, token.metadata)}
            <span className="ml-2 text-sm font-normal tracking-normal text-zinc-500">of {formatAmount(budget.daily_limit, token.metadata)}</span>
            <span className="mt-3 block h-1 overflow-hidden rounded-full bg-zinc-100" aria-hidden="true">
              <span className="block h-full rounded-full bg-paid" style={{ width: `${usedPercent(budget)}%` }} />
            </span>
          </>
        ) : (
          "unknown"
        ),
      ],
      [counts.read < counts.stored ? `Paid, of the last ${counts.read}` : "Paid", "live-paid", counts.paid],
      ["Waiting for the owner", "live-waiting", counts.waiting],
    ];
    body = (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="live">
        {stats.map(([label, testId, value], i) => (
          <Reveal key={testId} delay={i * 90} className="h-full">
            <Stat label={label} testId={testId}>
              {value}
            </Stat>
          </Reveal>
        ))}
      </div>
    );
  }

  return (
    <section className="pb-24" aria-labelledby="live">
      <Container>
        <Reveal>
          <SectionTitle label="Live vault" title={`Running on ${NETWORK_NAME[config.network]}`} id="live">
            <p>
              Read just now from <Mono>{config.vaultId}</Mono> over RPC. This page holds no keys and signs nothing.
            </p>
          </SectionTitle>
        </Reveal>
        <div className="mt-12">{body}</div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-xl text-xs text-zinc-500">
            Blocked requests are refused before anything is stored, so they never show up here.
            {vaultLink ? (
              <>
                {" "}
                <a href={vaultLink} target="_blank" rel="noreferrer noopener" className="underline underline-offset-2 hover:text-ink">
                  Every transaction on the explorer
                </a>
                .
              </>
            ) : null}
          </p>
          <TextLink href="?page=overview">Open the dashboard</TextLink>
        </div>
      </Container>
    </section>
  );
}

function NoVaultSection() {
  return (
    <section className="pb-24" aria-labelledby="live">
      <Container>
        <SectionTitle label="Live vault" title="No vault on this site yet" id="live" />
        <div className="mt-8">
          <Notice tone="info" title="No vault is connected to this site yet">
            <p>This build has no vault, so there is nothing live to show. The Security Lab works.</p>
          </Notice>
        </div>
      </Container>
    </section>
  );
}

function HeroProof({ lab }: { lab: LoadResult | null }) {
  const view = lab?.kind === "ok" ? lab.view : null;
  if (!view) return null;
  return (
    <p className="mt-10 flex items-center gap-2 border-t border-line pt-6 text-sm text-zinc-600" data-testid="hero-proof">
      <SignalDot signal="paid" />
      <span>
        <span className="font-semibold text-ink">
          {view.counts.PASSED_ON_CHAIN} of {view.cases.length}
        </span>{" "}
        attacks from the spec pass on a local NEAR chain, {view.report.source.kind === "ci" ? "in CI" : "in a local run"}.
      </span>
    </p>
  );
}

/** The public front page: what SpactVault is, how it decides, and what the configured vault is doing. */
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
  const example = token ? gateExample(token.policy, token.metadata) : GENERIC_GATE;
  const caption =
    token && vaultConfig
      ? `These are the live limits of ${vaultConfig.vaultId}, read from its policy. Each owner sets their own.`
      : "Each owner sets their own numbers.";
  const source =
    !example.example && vaultConfig
      ? `Amounts picked from the limits of ${vaultConfig.vaultId}, read from its policy.`
      : "Example limits. Each owner sets their own.";

  return (
    <div data-testid="landing">
      <section>
        <Container className="grid grid-cols-1 items-center gap-12 pt-16 pb-12 sm:pt-24 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-zinc-600">
              <SignalDot signal={vaultConfig ? "paid" : "waits"} className="h-2 w-2" />
              {vaultConfig ? `Live on ${NETWORK_NAME[vaultConfig.network]}` : "Unaudited hackathon prototype"}
            </p>
            <h1 className="mt-6 max-w-2xl bg-linear-to-r from-ink to-brand bg-clip-text pb-1 text-5xl font-bold tracking-tight text-transparent sm:text-6xl lg:text-5xl">
              Autonomous spending.
              <br />
              Human rules.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-600">
              A spending firewall for AI agents on NEAR. Your agent asks a vault contract to pay, and the contract applies your rules on chain.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-6">
              {vaultConfig ? <PrimaryLink href="?page=overview">Open the dashboard</PrimaryLink> : <PrimaryLink href="?page=security">See the Security Lab</PrimaryLink>}
              {vaultConfig ? <TextLink href="?page=security">See the Security Lab</TextLink> : null}
            </div>
            <HeroProof lab={lab} />
          </div>
          <GateFlow example={example} source={source} />
        </Container>
      </section>

      <Outcomes rules={rules} caption={caption} example={example} />
      {vaultConfig ? <LiveSection config={vaultConfig} live={live} /> : <NoVaultSection />}
    </div>
  );
}
