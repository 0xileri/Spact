import { ArrowRight, Check, Fingerprint, Robot, Vault, X } from "@phosphor-icons/react";
import { useEffect, useState, type ReactNode } from "react";

import { explorerAccountLink, type AppConfig, type SiteConfig } from "../config.js";
import { usedPercent } from "../dashboard.js";
import { errorMessage, formatAmount, formatRelative } from "../format.js";
import { GENERIC_RULES, liveCounts, outcomeRules, type OutcomeRules } from "../landing.js";
import { loadDashboard, type DashboardSnapshot } from "../near/vault.js";
import { loadSecurityReport, type LoadResult } from "../securityLab.js";
import { SignalDot, type Signal } from "./Brand.js";
import { Reveal, TaglineReveal } from "./Motion.js";
import { Mono, Notice, StatusBadge } from "./ui.js";

/** Newest requests read for the live section. */
const READ = 50;

const NETWORK_NAME = { sandbox: "a local NEAR sandbox", testnet: "NEAR testnet", mainnet: "NEAR mainnet" } as const;

type Live = { kind: "none" } | { kind: "loading" } | { kind: "ok"; snapshot: DashboardSnapshot } | { kind: "error"; message: string };

const MOTION = "transition duration-300 ease-fluid active:translate-y-px";

function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-6xl px-6 ${className}`}>{children}</div>;
}

/** The page's one primary action style: ink, semibold, with an arrow. */
function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className={`group inline-flex items-center gap-2 rounded-lg bg-ink px-3 py-2 text-base font-semibold text-paper hover:bg-stone-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${MOTION}`}
    >
      {children}
      <ArrowRight size={16} weight="bold" aria-hidden="true" className="transition-transform duration-300 ease-fluid group-hover:translate-x-1" />
    </a>
  );
}

/** Secondary actions are text links, not a second button. */
function TextLink({ href, children, external = false }: { href: string; children: ReactNode; external?: boolean }) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
      className="inline-flex items-center gap-1 text-base font-semibold text-ink underline decoration-stone-300 underline-offset-4 transition-colors duration-300 ease-fluid hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      {children}
    </a>
  );
}

/** Inline code in prose: wraps between words, never inside an identifier. */
function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-stone-100 px-1 py-0.5 font-mono text-sm break-words">{children}</code>;
}

function Label({ children }: { children: ReactNode }) {
  return <p className="font-mono text-xs text-stone-500">{children}</p>;
}

function SectionTitle({ label, title, id, children }: { label: string; title: string; id?: string; children?: ReactNode }) {
  return (
    <div className="max-w-2xl">
      <Label>{label}</Label>
      <h2 id={id} className="mt-3 text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
        {title}
      </h2>
      {children ? <div className="mt-4 text-base leading-relaxed text-stone-600">{children}</div> : null}
    </div>
  );
}

/* Hero illustration: one request on its way through Spact. Static, and labeled as an example. */

function WindowDots() {
  return (
    <span className="flex gap-2" aria-hidden="true">
      <span className="h-2 w-2 rounded-full bg-stone-600" />
      <span className="h-2 w-2 rounded-full bg-stone-600" />
      <span className="h-2 w-2 rounded-full bg-stone-600" />
    </span>
  );
}

function FlowIllustration() {
  return (
    <figure aria-label="Example: an agent asks for 12 TUSD, the vault holds it, and the owner approves the exact terms">
      <div className="space-y-3" aria-hidden="true">
        <div className="rounded-2xl bg-ink p-4 text-stone-200 shadow-xl shadow-stone-900/10 lg:mr-12">
          <div className="flex items-center justify-between">
            <WindowDots />
            <span className="font-mono text-xs text-stone-500">claude code</span>
          </div>
          <div className="mt-3 space-y-2 font-mono text-xs leading-relaxed">
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
          <Label>Vault policy, on chain</Label>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex items-center justify-between gap-3 text-stone-500">
              <span className="flex items-center gap-2">
                <SignalDot signal="paid" /> Paid at once
              </span>
              <span className="font-mono text-xs">≤ 10 TUSD</span>
            </li>
            <li className="-mx-2 flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-2 py-2 font-medium text-ink ring-1 ring-amber-200">
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
              <p className="mt-1 text-xl font-semibold">12 TUSD</p>
              <p className="font-mono text-xs text-stone-600">to api.weather.testnet</p>
            </div>
            <span className="flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
              <Check size={12} weight="bold" /> hash matches
            </span>
          </div>
          <div className="mt-4 flex gap-2">
            <span className="flex-1 rounded-lg py-2 text-center text-xs font-medium text-stone-600 ring-1 ring-line">Reject</span>
            <span className="flex-1 rounded-lg bg-emerald-700 py-2 text-center text-xs font-medium text-white">Approve and pay</span>
          </div>
        </div>
      </div>
      <figcaption className="mt-4 text-center text-xs text-stone-500 lg:text-right">Example flow. The live numbers are further down.</figcaption>
    </figure>
  );
}

const OUTCOMES: { signal: Signal; title: string; key: keyof OutcomeRules; after: string }[] = [
  { signal: "paid", title: "Paid at once", key: "paid", after: "The vault pays and records it. Nobody is asked." },
  { signal: "waits", title: "Waits for your wallet", key: "waits", after: "Stored until you approve the exact terms, or until it expires." },
  { signal: "blocked", title: "Blocked", key: "blocked", after: "Refused on chain. Nothing is stored or sent." },
];

function Outcomes({ rules, caption }: { rules: OutcomeRules; caption: string }) {
  return (
    <section className="border-y border-line bg-surface">
      <Container className="grid grid-cols-1 gap-12 py-20 lg:grid-cols-[1fr_2fr]">
        <Reveal>
          <SectionTitle label="The rules" title="Every request ends one of three ways." id="outcomes-title">
            <p className="text-sm">{caption}</p>
          </SectionTitle>
        </Reveal>
        <Reveal>
          <ul className="divide-y divide-line border-y border-line" data-testid="outcomes">
            {OUTCOMES.map((o) => (
              <li key={o.signal} className="grid gap-2 py-6 sm:grid-cols-[12rem_1fr] sm:gap-6" data-outcome={o.signal}>
                <p className="flex items-center gap-2 text-base font-semibold">
                  <SignalDot signal={o.signal} />
                  {o.title}
                </p>
                <div>
                  <p className="text-lg font-semibold text-ink" data-testid={`rule-${o.signal}`}>
                    {rules[o.key]}
                  </p>
                  <p className="mt-1 text-sm text-stone-500">{o.after}</p>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>
      </Container>
    </section>
  );
}

const STEPS = [
  {
    icon: Robot,
    title: "Your agent asks",
    body: "From Claude Code or Codex, through two MCP tools. Its NEAR key can call two vault methods and nothing else, so it cannot move funds by itself.",
    detail: "function call key: request_direct_payment, execute_request",
  },
  {
    icon: Vault,
    title: "The vault decides, on chain",
    body: "Allowlisted payees, a cap per payment, an auto limit, and a daily budget that counts payments still in flight. The agent cannot change any of it.",
    detail: "auto_limit · hard_tx_limit · daily_limit · recipients",
  },
  {
    icon: Fingerprint,
    title: "You approve the rest",
    body: "You see the exact terms and sign their hash in your wallet. If anything between you and the chain alters them, the vault rejects the approval.",
    detail: "approve_request(id, sha256(terms))",
  },
];

function HowItWorks() {
  return (
    <section className="py-24">
      <Container className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1.4fr]">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <Reveal>
            <SectionTitle label="How it works" title="Three steps. Only one needs you." id="how">
              <p>The agent never holds money it can spend freely. It holds a key that can only ask.</p>
            </SectionTitle>
          </Reveal>
        </div>
        <ol className="relative space-y-12 border-l border-line pl-8">
          {STEPS.map((s) => (
            <li key={s.title} className="relative">
              <Reveal>
                <span className="absolute top-0 -left-12 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface text-ink">
                  <s.icon size={16} aria-hidden="true" />
                </span>
                <p className="text-xl font-semibold">{s.title}</p>
                <p className="mt-2 max-w-xl text-base leading-relaxed text-stone-600">{s.body}</p>
                <p className="mt-3 font-mono text-xs break-words text-stone-500">{s.detail}</p>
              </Reveal>
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
        <Reveal>
          <SectionTitle label="Why not just a wallet" title="A wallet key can spend everything. A vault cannot." id="why">
            <p>
              A NEAR function call key limits which methods an agent can call, but its allowance caps gas, not money. Spact puts the money rules in a
              contract the agent cannot change.
            </p>
          </SectionTitle>
        </Reveal>
        <Reveal className="mt-12">
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="hidden grid-cols-[1fr_1.2fr_1.2fr] border-b border-line text-xs font-medium text-stone-500 md:grid">
              <span className="px-6 py-3" />
              <span className="px-6 py-3">Agent holds a wallet key</span>
              <span className="px-6 py-3 text-ink">Agent asks Spact</span>
            </div>
            <ul className="divide-y divide-line">
              {COMPARISON.map(([label, wallet, spact]) => (
                <li key={label} className="grid gap-2 px-6 py-4 text-sm md:grid-cols-[1fr_1.2fr_1.2fr] md:gap-0 md:px-0 md:py-0">
                  <span className="font-medium text-ink md:px-6 md:py-4">{label}</span>
                  <span className="flex items-start gap-2 text-stone-500 md:px-6 md:py-4">
                    <X size={16} weight="bold" className="mt-0.5 shrink-0 text-blocked" aria-label="A wallet key:" />
                    {wallet}
                  </span>
                  <span className="flex items-start gap-2 text-ink md:px-6 md:py-4">
                    <Check size={16} weight="bold" className="mt-0.5 shrink-0 text-paid" aria-label="Spact:" />
                    {spact}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

function Tagline() {
  return (
    <section className="py-24" aria-label="In short">
      <Container>
        <TaglineReveal
          className="max-w-2xl text-4xl leading-tight font-bold tracking-tight sm:text-5xl"
          lines={["Your agent gets a budget,", "not your keys.", "Anything bigger", "waits for you."]}
        />
      </Container>
    </section>
  );
}

function Stat({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <p className="text-xs font-medium text-stone-500">{label}</p>
      <div className="mt-2 text-3xl font-semibold tracking-tight" data-testid={testId}>
        {children}
      </div>
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-6" aria-hidden="true">
      <div className="h-3 w-20 animate-pulse rounded bg-stone-100" />
      <div className="mt-4 h-8 w-28 animate-pulse rounded bg-stone-100" />
    </div>
  );
}

function LiveSection({ config, live }: { config: AppConfig; live: Live }) {
  const vaultLink = explorerAccountLink(config, config.vaultId);
  const heading = (
    <Reveal>
      <SectionTitle label="Live vault" title={`Running on ${NETWORK_NAME[config.network]}`} id="live">
        <p>
          Read just now from <Mono>{config.vaultId}</Mono> over RPC. This page holds no keys and signs nothing.
        </p>
      </SectionTitle>
    </Reveal>
  );
  if (live.kind !== "ok") {
    return (
      <section className="pb-24">
        <Container>
          {heading}
          <div className="mt-12">
            {live.kind === "error" ? (
              <Notice tone="warn" title="Could not read the vault right now">
                <p>{live.message}</p>
              </Notice>
            ) : (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Reading the vault from the chain">
                <StatSkeleton />
                <StatSkeleton />
                <StatSkeleton />
                <StatSkeleton />
              </div>
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
        <div className="mt-12 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="In the vault" testId="live-balance">
            {token && token.balance !== null ? formatAmount(token.balance.toString(), token.metadata) : "unknown"}
          </Stat>
          <Stat label="Spent today (UTC)" testId="live-spent">
            {budget && token ? (
              <>
                {formatAmount(budget.executed, token.metadata)}
                <span className="ml-2 text-sm font-normal tracking-normal text-stone-500">of {formatAmount(budget.daily_limit, token.metadata)}</span>
                <span className="mt-3 block h-1 overflow-hidden rounded-full bg-stone-100" aria-hidden="true">
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
            <p className="border-b border-line px-6 py-3 text-xs font-medium text-stone-500">Latest agent requests</p>
            <ul className="divide-y divide-line" data-testid="live-recent">
              {recent.map((r) => (
                <li key={r.request_id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-6 py-4 text-sm">
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
          <TextLink href="?page=overview">Open the dashboard</TextLink>
        </div>
      </Container>
    </section>
  );
}

function SecuritySection({ lab }: { lab: LoadResult | null }) {
  const view = lab?.kind === "ok" ? lab.view : null;
  const examples = view ? view.cases.filter((c) => c.derived === "PASSED_ON_CHAIN").slice(0, 3) : [];
  return (
    <section className="border-y border-line bg-surface py-24" data-testid="lab-teaser">
      <Container className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1.2fr]">
        <Reveal>
          <SectionTitle label="Security Lab" title="Every attack in the spec, run against the code." id="security">
            {view ? (
              <p data-testid="lab-teaser-counts">
                {view.cases.length} attacks from the spec, each tied to the tests that try it: {view.counts.PASSED_ON_CHAIN} pass on a local NEAR chain,{" "}
                {view.counts.PASSED_UNIT_ONLY} in unit tests only, {view.counts.NOT_COVERED} not covered yet
                {view.counts.FAILED > 0 ? `, ${view.counts.FAILED} failing` : ""}. CI builds the report from the commit this site runs.
              </p>
            ) : (
              <p>Each attack from the spec, tied to the tests that try it, with results built by CI.</p>
            )}
          </SectionTitle>
          <div className="mt-8">
            <PrimaryLink href="?page=security">See every attack and its tests</PrimaryLink>
          </div>
        </Reveal>
        {view ? (
          <Reveal>
            <div className="flex flex-wrap items-end gap-x-12 gap-y-6 border-b border-line pb-8">
              <div>
                <p className="text-7xl font-bold tracking-tight">
                  {view.counts.PASSED_ON_CHAIN}
                  <span className="text-3xl font-normal text-stone-400">/{view.cases.length}</span>
                </p>
                <p className="mt-2 flex items-center gap-2 text-sm text-stone-600">
                  <SignalDot signal="paid" /> pass on a local NEAR chain
                </p>
              </div>
              <dl className="space-y-2 text-sm text-stone-600">
                <div className="flex items-center gap-2">
                  <SignalDot signal="waits" />
                  <dt className="font-semibold text-ink">{view.counts.PASSED_UNIT_ONLY}</dt>
                  <dd>in unit tests only</dd>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-stone-300" aria-hidden="true" />
                  <dt className="font-semibold text-ink">{view.counts.NOT_COVERED}</dt>
                  <dd>not covered yet</dd>
                </div>
              </dl>
            </div>
            <ul className="divide-y divide-line">
              {examples.map((c) => (
                <li key={c.id} className="flex gap-4 py-4 text-sm">
                  <span className="font-mono text-xs text-stone-500">{c.id}</span>
                  <span className="text-stone-700">{c.attack}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        ) : null}
      </Container>
    </section>
  );
}

const FAQ: [string, ReactNode][] = [
  [
    "Is this real money?",
    "No. This deployment runs on NEAR testnet with TUSD, a test token with no value. Spact is an unaudited hackathon prototype; do not use it with real funds.",
  ],
  [
    "What stops the agent from paying more?",
    "The vault contract. It checks every request against your cap per payment, your daily budget and your payee list before anything moves. The agent's key can call only two vault methods, and neither changes the rules.",
  ],
  [
    "What does the agent hold?",
    "A NEAR function call key that can call request_direct_payment and execute_request on your vault, and nothing else. It cannot transfer NEAR, add keys or call other contracts.",
  ],
  [
    "What exactly do I approve?",
    "The terms on the page: amount, token, payee, vault, network and policy version. Your wallet signs their hash, and the vault refuses the approval if its stored request hashes differently.",
  ],
  ["Can a request be paid twice?", "No. Each request id is paid at most once. A retry with the same id is refused."],
  [
    "What if the page or the RPC lies to me?",
    "The page recomputes the hash from what it shows, so altered terms fail the vault's check. A lying RPC can still show a wrong balance or status, so read the vault through an RPC you trust.",
  ],
  ["Which agents work with it?", "Any MCP host. It is tested with Claude Code. Codex takes the same settings, but it has not been tried yet."],
  ["Is the code audited?", "No. The Security Lab shows which attacks the tests cover today, and which they do not cover yet."],
];

function Faq() {
  return (
    <section className="py-24">
      <Container className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_2fr]">
        <Reveal>
          <SectionTitle label="Questions" title="What people ask first." id="faq" />
        </Reveal>
        <Reveal>
          <dl className="divide-y divide-line border-y border-line" data-testid="faq">
            {FAQ.map(([q, a]) => (
              <div key={q} className="grid gap-2 py-6 md:grid-cols-[16rem_1fr] md:gap-8">
                <dt className="text-base font-semibold">{q}</dt>
                <dd className="text-base leading-relaxed text-stone-600">{a}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </Container>
    </section>
  );
}

function GetStarted({ repoUrl }: { repoUrl: string | null }) {
  const clone = repoUrl ? `git clone ${repoUrl}.git && cd ${repoUrl.split("/").pop() ?? "spact"}` : "git clone <this repository> && cd <it>";
  return (
    <section className="pb-24">
      <Container className="grid grid-cols-1 items-start gap-12 lg:grid-cols-[1fr_1.1fr]">
        <Reveal>
          <SectionTitle label="Get started" title="Try it in two minutes, no wallet needed." id="start">
            <p>
              <Code>scripts/dev-sandbox.sh</Code> starts a local NEAR node, deploys a funded vault and opens this site with a test signer. Then connect
              your agent: <Code>apps/mcp</Code> gives Claude Code or Codex two tools, <Code>request_payment</Code> and <Code>get_payment_status</Code>.
            </p>
          </SectionTitle>
          {repoUrl ? (
            <div className="mt-8 flex flex-wrap items-center gap-6">
              <TextLink href={repoUrl} external>
                Read the README
              </TextLink>
              <TextLink href={`${repoUrl}/tree/main/apps/mcp`} external>
                MCP server setup
              </TextLink>
            </div>
          ) : null}
        </Reveal>
        <Reveal>
          <div className="overflow-hidden rounded-2xl bg-ink text-stone-200 shadow-xl shadow-stone-900/10">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <WindowDots />
              <span className="font-mono text-xs text-stone-500">terminal</span>
            </div>
            <pre className="overflow-x-auto p-6 font-mono text-xs leading-6">
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
        </Reveal>
      </Container>
    </section>
  );
}

function FinalCta({ hasVault }: { hasVault: boolean }) {
  return (
    <section className="border-t border-line py-24">
      <Container className="flex flex-wrap items-end justify-between gap-8">
        <Reveal>
          <h2 className="max-w-2xl text-3xl leading-tight font-bold tracking-tight sm:text-4xl">See the rules your agent would live under.</h2>
          <p className="mt-3 text-base text-stone-600">Free and open source. No sign up. Test tokens only.</p>
        </Reveal>
        <div className="flex flex-wrap items-center gap-6">
          {hasVault ? <PrimaryLink href="?page=overview">Open the dashboard</PrimaryLink> : <PrimaryLink href="?page=security">See the Security Lab</PrimaryLink>}
          {hasVault ? <TextLink href="?page=security">See the Security Lab</TextLink> : null}
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
  const labView = lab?.kind === "ok" ? lab.view : null;

  return (
    <div data-testid="landing">
      <section>
        <Container className="grid grid-cols-1 items-center gap-16 pt-16 pb-20 sm:pt-24 lg:grid-cols-[1.25fr_1fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-stone-600">
              <SignalDot signal={vaultConfig ? "paid" : "waits"} className="h-2 w-2" />
              {vaultConfig ? `Live on ${NETWORK_NAME[vaultConfig.network]}` : "Unaudited hackathon prototype"}
            </p>
            <h1 className="mt-6 max-w-2xl bg-linear-to-r from-ink to-stone-500 bg-clip-text pb-1 text-4xl font-bold tracking-tight text-transparent sm:text-6xl lg:text-5xl">
              Autonomous spending.
              <br />
              Human rules.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-stone-600">
              Spact is a spending firewall for AI agents on NEAR. Your agent asks a vault contract to pay. The contract checks your rules on chain: small
              payments go through, larger ones wait for your wallet, and the rest are blocked.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-6">
              {vaultConfig ? <PrimaryLink href="?page=overview">Open the dashboard</PrimaryLink> : <PrimaryLink href="?page=security">See the Security Lab</PrimaryLink>}
              {vaultConfig ? <TextLink href="?page=security">See the Security Lab</TextLink> : null}
            </div>
            <p className="mt-6 text-sm text-stone-500">Free and open source. No sign up. Test tokens only.</p>
            {labView ? (
              <p className="mt-8 flex items-center gap-2 border-t border-line pt-6 text-sm text-stone-600" data-testid="hero-proof">
                <SignalDot signal="paid" />
                <span>
                  <span className="font-semibold text-ink">
                    {labView.counts.PASSED_ON_CHAIN} of {labView.cases.length}
                  </span>{" "}
                  attacks from the spec pass on a local NEAR chain, {labView.report.source.kind === "ci" ? "in CI" : "in a local run"}.
                </span>
              </p>
            ) : null}
          </div>
          <FlowIllustration />
        </Container>
      </section>

      <Outcomes rules={rules} caption={caption} />
      <HowItWorks />
      <Comparison />
      <Tagline />

      {vaultConfig ? (
        <LiveSection config={vaultConfig} live={live} />
      ) : (
        <section className="pb-24">
          <Container>
            <SectionTitle label="Live vault" title="No vault on this site yet" id="live" />
            <div className="mt-8">
              <Notice tone="info" title="No vault is connected to this site yet">
                <p>This build has no vault, so there is nothing live to show. The Security Lab works.</p>
              </Notice>
            </div>
          </Container>
        </section>
      )}

      <SecuritySection lab={lab} />
      <Faq />
      <GetStarted repoUrl={config.repoUrl} />
      <FinalCta hasVault={vaultConfig !== null} />
    </div>
  );
}
