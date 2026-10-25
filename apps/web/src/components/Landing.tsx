import { useEffect, useState, type ReactNode } from "react";

import { explorerAccountLink, type AppConfig, type SiteConfig } from "../config.js";
import { usedPercent } from "../dashboard.js";
import { errorMessage, formatAmount, formatRelative } from "../format.js";
import { GENERIC_RULES, liveCounts, outcomeRules, type OutcomeRules } from "../landing.js";
import { loadDashboard, type DashboardSnapshot } from "../near/vault.js";
import { loadSecurityReport, type LoadResult } from "../securityLab.js";
import { SignalDot, type Signal } from "./Brand.js";
import { Mono, Notice, StatusBadge } from "./ui.js";

/** Newest requests read for the live section. */
const READ = 50;

const NETWORK_NAME = { sandbox: "a local NEAR sandbox", testnet: "NEAR testnet", mainnet: "NEAR mainnet" } as const;

type Live = { kind: "none" } | { kind: "loading" } | { kind: "ok"; snapshot: DashboardSnapshot } | { kind: "error"; message: string };

function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-6xl px-5 ${className}`}>{children}</div>;
}

function LinkButton({
  href,
  children,
  variant = "primary",
  external = false,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "light";
  external?: boolean;
}) {
  const styles = {
    primary: "bg-ink text-paper hover:bg-stone-800",
    secondary: "bg-surface text-ink ring-1 ring-line hover:ring-stone-300",
    light: "bg-paper text-ink hover:bg-white",
  }[variant];
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${styles}`}
    >
      {children}
    </a>
  );
}

/** Inline code in prose: wraps between words, never inside an identifier. */
function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-stone-100 px-1 py-0.5 font-mono text-[0.85em] break-words">{children}</code>;
}

function Eyebrow({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return <p className={`font-mono text-xs tracking-[0.16em] uppercase ${dark ? "text-stone-400" : "text-stone-500"}`}>{children}</p>;
}

function SectionHeading({ eyebrow, title, children, dark = false, id }: { eyebrow: string; title: string; children?: ReactNode; dark?: boolean; id?: string }) {
  return (
    <div className="max-w-3xl">
      <Eyebrow dark={dark}>{eyebrow}</Eyebrow>
      <h2 id={id} className="mt-3 font-display text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      {children ? <div className={`mt-4 max-w-2xl text-base leading-relaxed ${dark ? "text-stone-300" : "text-stone-600"}`}>{children}</div> : null}
    </div>
  );
}

/* Hero illustration: one request on its way through Spact. Static and labeled as an example. */

function WindowDots() {
  return (
    <span className="flex gap-1.5" aria-hidden="true">
      <span className="h-2.5 w-2.5 rounded-full bg-stone-600" />
      <span className="h-2.5 w-2.5 rounded-full bg-stone-600" />
      <span className="h-2.5 w-2.5 rounded-full bg-stone-600" />
    </span>
  );
}

function FlowIllustration() {
  return (
    <figure className="relative" aria-label="Example: an agent asks for 12 TUSD, the vault holds it, and the owner approves the exact terms">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-stone-200/70 via-transparent to-emerald-100/50 blur-2xl" aria-hidden="true" />
      <div className="space-y-3" aria-hidden="true">
        <div className="rounded-2xl bg-ink p-4 text-stone-200 shadow-xl shadow-stone-900/10 lg:mr-12">
          <div className="flex items-center justify-between">
            <WindowDots />
            <span className="font-mono text-[11px] text-stone-500">claude code</span>
          </div>
          <div className="mt-3 space-y-1.5 font-mono text-[12.5px] leading-relaxed">
            <p>
              <span className="text-stone-500">›</span> upgrade the weather API plan
            </p>
            <p className="text-stone-400">
              <span className="text-paid">spact</span>.request_payment(<span className="text-stone-200">12 TUSD</span> → api.weather.testnet)
            </p>
            <p className="text-waits">waiting for the owner&apos;s approval</p>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4 shadow-lg shadow-stone-900/5 lg:mx-6">
          <p className="font-mono text-[11px] tracking-[0.14em] text-stone-500 uppercase">Vault policy, on chain</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex items-center justify-between gap-3 text-stone-500">
              <span className="flex items-center gap-2">
                <SignalDot signal="paid" /> Paid at once
              </span>
              <span className="font-mono text-xs">≤ 10 TUSD</span>
            </li>
            <li className="-mx-2 flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-2 py-1.5 font-medium text-ink ring-1 ring-amber-200">
              <span className="flex items-center gap-2">
                <SignalDot signal="waits" /> Waits for your wallet
              </span>
              <span className="font-mono text-xs">12 TUSD</span>
            </li>
            <li className="flex items-center justify-between gap-3 text-stone-500">
              <span className="flex items-center gap-2">
                <SignalDot signal="blocked" /> Blocked
              </span>
              <span className="font-mono text-xs">&gt; 30 TUSD</span>
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4 shadow-lg shadow-stone-900/5 lg:ml-16">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-stone-500">Approve this payment?</p>
              <p className="mt-0.5 font-display text-xl font-semibold">12 TUSD</p>
              <p className="font-mono text-xs text-stone-600">to api.weather.testnet</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 ring-1 ring-emerald-200">hash matches</span>
          </div>
          <div className="mt-4 flex gap-2">
            <span className="flex-1 rounded-lg py-2 text-center text-xs font-medium text-stone-600 ring-1 ring-line">Reject</span>
            <span className="flex-1 rounded-lg bg-emerald-700 py-2 text-center text-xs font-medium text-white">Approve and pay</span>
          </div>
        </div>
      </div>
      <figcaption className="mt-4 text-center text-xs text-stone-500 lg:text-right">Example flow. Live numbers are further down.</figcaption>
    </figure>
  );
}

const OUTCOMES: { signal: Signal; title: string; key: keyof OutcomeRules; after: string }[] = [
  { signal: "paid", title: "Paid at once", key: "paid", after: "The vault pays and records it. Nobody is asked." },
  { signal: "waits", title: "Waits for your wallet", key: "waits", after: "Stored until you approve the exact terms, or it expires." },
  { signal: "blocked", title: "Blocked", key: "blocked", after: "Refused on chain. Nothing is stored or sent." },
];

function Outcomes({ rules, caption }: { rules: OutcomeRules; caption: string }) {
  return (
    <section className="border-y border-line bg-surface" aria-labelledby="outcomes-title">
      <Container className="py-12">
        <h2 id="outcomes-title" className="sr-only">
          What happens when the agent asks to pay
        </h2>
        <ul className="grid gap-8 md:grid-cols-3 md:gap-0 md:divide-x md:divide-line" data-testid="outcomes">
          {OUTCOMES.map((o) => (
            <li key={o.signal} className="md:px-8 md:first:pl-0 md:last:pr-0" data-outcome={o.signal}>
              <p className="flex items-center gap-2 text-sm font-medium text-stone-600">
                <SignalDot signal={o.signal} />
                {o.title}
              </p>
              <p className="mt-3 font-display text-lg leading-snug font-semibold text-balance text-ink" data-testid={`rule-${o.signal}`}>
                {rules[o.key]}
              </p>
              <p className="mt-2 text-sm text-stone-500">{o.after}</p>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-xs text-stone-500">{caption}</p>
      </Container>
    </section>
  );
}

const STEPS = [
  {
    title: "Your agent asks",
    body: "From Claude Code or Codex, through two MCP tools. Its NEAR key can call two vault methods and nothing else, so it cannot move funds by itself.",
    detail: "function-call key: request_direct_payment, execute_request",
  },
  {
    title: "The vault decides, on chain",
    body: "Allowlisted payees, a cap per payment, an auto limit, and a daily budget that counts payments still in flight. The agent cannot change any of it.",
    detail: "auto_limit · hard_tx_limit · daily_limit · recipients",
  },
  {
    title: "You approve the rest",
    body: "You see the exact terms and sign their hash in your wallet. If anything between you and the chain alters them, the vault rejects the approval.",
    detail: "approve_request(id, sha256(terms))",
  },
];

function HowItWorks() {
  return (
    <section className="py-24">
      <Container>
        <SectionHeading eyebrow="How it works" title="Three steps. Only one needs you." id="how" />
        <ol className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          <span className="absolute top-5 right-[16%] left-[16%] hidden h-px bg-line md:block" aria-hidden="true" />
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative">
              <span className="relative flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface font-display text-sm font-semibold">
                {i + 1}
              </span>
              <p className="mt-5 font-display text-lg font-semibold">{s.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">{s.body}</p>
              <p className="mt-4 font-mono text-xs break-words text-stone-500">{s.detail}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

const COMPARISON: [string, string, string][] = [
  ["Most it can spend", "Everything the key controls, in one transaction", "A capped amount per payment, and a daily budget"],
  ["Larger payments", "Sent without asking", "Wait for your wallet"],
  ["Who it can pay", "Anyone", "Only accounts on your list"],
  ["What you approve", "Nothing", "The exact terms, bound by their hash"],
  ["Retries", "Can pay twice", "Each request id pays at most once"],
];

function Comparison() {
  return (
    <section className="pb-24">
      <Container>
        <SectionHeading eyebrow="Why not just a wallet" title="A wallet key can spend everything. A vault cannot." id="why">
          <p>
            A NEAR function-call key limits which methods an agent can call, but its allowance caps gas, not money. Spact puts the money rules in a
            contract the agent cannot change.
          </p>
        </SectionHeading>
        <div className="mt-10 overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="hidden grid-cols-[1fr_1.2fr_1.2fr] border-b border-line bg-stone-50 text-xs font-medium text-stone-500 md:grid">
            <span className="px-6 py-3" />
            <span className="px-6 py-3">Agent holds a wallet key</span>
            <span className="px-6 py-3 text-ink">Agent asks Spact</span>
          </div>
          <ul className="divide-y divide-line">
            {COMPARISON.map(([label, wallet, spact]) => (
              <li key={label} className="grid gap-2 px-6 py-4 text-sm md:grid-cols-[1fr_1.2fr_1.2fr] md:gap-0 md:px-0 md:py-0">
                <span className="font-medium text-ink md:px-6 md:py-4">{label}</span>
                <span className="flex items-start gap-2 text-stone-500 md:px-6 md:py-4">
                  <span className="mt-0.5 font-mono text-blocked" aria-label="Wallet key:">
                    ✕
                  </span>
                  {wallet}
                </span>
                <span className="flex items-start gap-2 text-ink md:px-6 md:py-4">
                  <span className="mt-0.5 font-mono text-paid" aria-label="Spact:">
                    ✓
                  </span>
                  {spact}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}

function Stat({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-xs font-medium text-stone-500">{label}</p>
      <div className="mt-2 font-display text-3xl font-semibold tracking-tight" data-testid={testId}>
        {children}
      </div>
    </div>
  );
}

function LiveSection({ config, live }: { config: AppConfig; live: Live }) {
  const vaultLink = explorerAccountLink(config, config.vaultId);
  const heading = (
    <SectionHeading eyebrow="Live vault" title={`Running on ${NETWORK_NAME[config.network]}`} id="live">
      <p>
        Read just now from <Mono>{config.vaultId}</Mono> over RPC. This page holds no keys and signs nothing.
      </p>
    </SectionHeading>
  );
  if (live.kind !== "ok") {
    return (
      <section className="pb-24">
        <Container>
          {heading}
          <div className="mt-8">
            {live.kind === "error" ? (
              <Notice tone="warn" title="Could not read the vault right now">
                <p>{live.message}</p>
              </Notice>
            ) : (
              <p className="text-sm text-stone-500">Reading the vault from the chain…</p>
            )}
          </div>
        </Container>
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
    <section className="pb-24" data-testid="live">
      <Container>
        {heading}
        <div className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="In the vault" testId="live-balance">
            {token && token.balance !== null ? formatAmount(token.balance.toString(), token.metadata) : "unknown"}
          </Stat>
          <Stat label="Spent today (UTC)" testId="live-spent">
            {budget && token ? (
              <>
                {formatAmount(budget.executed, token.metadata)}
                <span className="ml-1.5 font-sans text-sm font-normal tracking-normal text-stone-500">of {formatAmount(budget.daily_limit, token.metadata)}</span>
                <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-stone-100" aria-hidden="true">
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
          <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface">
            <p className="border-b border-line px-5 py-3 text-xs font-medium text-stone-500">Latest agent requests</p>
            <ul className="divide-y divide-line" data-testid="live-recent">
              {recent.map((r) => (
                <li key={r.request_id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3.5 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium">{formatAmount(r.amount, metadataFor(r.token))}</span>
                    <span className="text-stone-500"> to </span>
                    <Mono>{r.recipient}</Mono>
                    <span className="block text-xs text-stone-500">
                      {r.request_id} · {formatRelative(Number((BigInt(r.updated_at_ns) - snapshot.nowNs) / 1_000_000_000n))}
                    </span>
                  </span>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-xl text-xs text-stone-500">
            Blocked requests are refused before anything is stored, so they never appear in this list.
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
          <LinkButton href="?page=overview" variant="secondary">
            Open the dashboard
          </LinkButton>
        </div>
      </Container>
    </section>
  );
}

function SecuritySection({ lab }: { lab: LoadResult | null }) {
  const view = lab?.kind === "ok" ? lab.view : null;
  const examples = view ? view.cases.filter((c) => c.derived === "PASSED_ON_CHAIN").slice(0, 3) : [];
  const tiles: { signal: Signal | null; value: number; label: string }[] = view
    ? [
        { signal: "paid", value: view.counts.PASSED_ON_CHAIN, label: "pass on a local NEAR chain" },
        { signal: "waits", value: view.counts.PASSED_UNIT_ONLY, label: "pass in unit tests only" },
        { signal: null, value: view.counts.NOT_COVERED, label: "not covered yet" },
      ]
    : [];
  return (
    <section className="bg-ink py-24 text-paper" data-testid="lab-teaser">
      <Container>
        <SectionHeading eyebrow="Security Lab" title="Every attack in the spec, run against the code." dark id="security">
          {view ? (
            <p data-testid="lab-teaser-counts">
              {view.cases.length} attacks from the spec, each tied to the tests that try it: {view.counts.PASSED_ON_CHAIN} pass on a local NEAR chain,{" "}
              {view.counts.PASSED_UNIT_ONLY} in unit tests only, {view.counts.NOT_COVERED} not covered yet
              {view.counts.FAILED > 0 ? `, ${view.counts.FAILED} failing` : ""}. CI builds the report from the commit this site runs.
            </p>
          ) : (
            <p>Each attack from the spec, tied to the tests that try it, with results built by CI.</p>
          )}
        </SectionHeading>

        {view ? (
          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {tiles.map((t) => (
              <div key={t.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="font-display text-4xl font-semibold tracking-tight">
                  {t.value}
                  <span className="ml-1 text-base font-normal text-stone-500">/ {view.cases.length}</span>
                </p>
                <p className="mt-2 flex items-center gap-2 text-sm text-stone-300">
                  {t.signal ? <SignalDot signal={t.signal} /> : <span className="h-2.5 w-2.5 rounded-full bg-stone-600" aria-hidden="true" />}
                  {t.label}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {examples.length > 0 ? (
          <ul className="mt-3 grid gap-3 md:grid-cols-3">
            {examples.map((c) => (
              <li key={c.id} className="rounded-2xl border border-white/10 p-5">
                <p className="font-mono text-xs text-stone-500">{c.id} · passed on a local chain</p>
                <p className="mt-2 text-sm leading-relaxed text-stone-200">{c.attack}</p>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-10">
          <LinkButton href="?page=security" variant="light">
            See every attack and its tests
          </LinkButton>
        </div>
      </Container>
    </section>
  );
}

function GetStarted({ repoUrl }: { repoUrl: string | null }) {
  const clone = repoUrl ? `git clone ${repoUrl}.git && cd ${repoUrl.split("/").pop() ?? "spact"}` : "git clone <this repository> && cd <it>";
  return (
    <section className="py-24">
      <Container className="grid items-start gap-12 lg:grid-cols-[1fr_1.1fr]">
        <SectionHeading eyebrow="Get started" title="Try it in two minutes, no wallet needed." id="start">
          <p>
            <Code>scripts/dev-sandbox.sh</Code> starts a local NEAR node, deploys a funded vault and opens this site with a test signer. Then connect
            your agent: <Code>apps/mcp</Code> gives Claude Code or Codex two tools, <Code>request_payment</Code> and <Code>get_payment_status</Code>.
          </p>
          {repoUrl ? (
            <div className="mt-6 flex flex-wrap gap-3">
              <LinkButton href={repoUrl} external>
                Read the README
              </LinkButton>
              <LinkButton href={`${repoUrl}/tree/main/apps/mcp`} variant="secondary" external>
                MCP server setup
              </LinkButton>
            </div>
          ) : null}
        </SectionHeading>
        <div className="overflow-hidden rounded-2xl bg-ink text-stone-200 shadow-xl shadow-stone-900/10">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <WindowDots />
            <span className="font-mono text-[11px] text-stone-500">terminal</span>
          </div>
          <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-7">
            <span className="text-stone-500">$ </span>
            {clone}
            {"\n"}
            <span className="text-stone-500">$ </span>pnpm install --frozen-lockfile{"\n"}
            <span className="text-stone-500">$ </span>scripts/dev-sandbox.sh{"\n"}
            <span className="text-stone-500"># a local chain, a funded vault and this site on localhost:5173,</span>
            {"\n"}
            <span className="text-stone-500"># plus the claude mcp add command for your agent</span>
          </pre>
        </div>
      </Container>
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
    token && vaultConfig
      ? `These are the live limits of ${vaultConfig.vaultId}, read from its policy. Each owner sets their own.`
      : "Each owner sets their own numbers.";

  return (
    <div data-testid="landing">
      <section className="overflow-hidden">
        <Container className="grid items-center gap-16 pt-16 pb-20 sm:pt-24 lg:grid-cols-[1.25fr_1fr] lg:pb-28">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-stone-600">
              <SignalDot signal={vaultConfig ? "paid" : "waits"} className="h-1.5 w-1.5" />
              {vaultConfig ? `Live on ${NETWORK_NAME[vaultConfig.network]}` : "Unaudited hackathon prototype"}
            </p>
            <h1 className="mt-6 font-display text-5xl leading-[1.02] font-bold tracking-[-0.03em] sm:text-6xl lg:text-[3.3rem] xl:text-[3.4rem]">
              Autonomous spending.
              <br />
              Human rules.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-stone-600">
              Spact is a spending firewall for AI agents on NEAR. Your agent asks a vault contract to pay. The contract checks your rules on chain: small
              payments go through, larger ones wait for your wallet, and the rest are blocked.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {vaultConfig ? <LinkButton href="?page=overview">Open the dashboard</LinkButton> : null}
              <LinkButton href="?page=security" variant={vaultConfig ? "secondary" : "primary"}>
                See the Security Lab
              </LinkButton>
            </div>
            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs text-stone-500">
              <li>Policy enforced by a NEAR contract</li>
              <li>Agent key limited to two methods</li>
              <li>Open source, unaudited, test tokens only</li>
            </ul>
          </div>
          <FlowIllustration />
        </Container>
      </section>

      <Outcomes rules={rules} caption={caption} />
      <HowItWorks />
      <Comparison />

      {vaultConfig ? (
        <LiveSection config={vaultConfig} live={live} />
      ) : (
        <section className="pb-24">
          <Container>
            <SectionHeading eyebrow="Live vault" title="No vault on this site yet" id="live" />
            <div className="mt-8">
              <Notice tone="info" title="No vault is connected to this site yet">
                <p>This build has no vault, so there is nothing live to show. The Security Lab works.</p>
              </Notice>
            </div>
          </Container>
        </section>
      )}

      <SecuritySection lab={lab} />
      <GetStarted repoUrl={config.repoUrl} />
    </div>
  );
}
