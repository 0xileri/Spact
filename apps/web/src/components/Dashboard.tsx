import { useCallback, useEffect, useState, type ReactNode } from "react";

import { explainReason, type FtMetadata, type PaymentRequest } from "@spact/shared";

import { explorerAccountLink, type AppConfig } from "../config.js";
import { budgetResetNs, isLapsed, usedPercent, waitingForOwner, type TokenSummary } from "../dashboard.js";
import { errorMessage, formatAmount, formatRelative, formatUtc } from "../format.js";
import { listRequests, loadDashboard, type DashboardSnapshot } from "../near/vault.js";
import { Badge, Button, Card, Mono, Notice, StatusBadge } from "./ui.js";

const PAGE = 50;
const REFRESH_MS = 15_000;

function requestLink(id: string): string {
  return `?request=${encodeURIComponent(id)}`;
}

function AccountLink({ config, account }: { config: AppConfig; account: string }) {
  const href = explorerAccountLink(config, account);
  return href ? (
    <a href={href} target="_blank" rel="noreferrer noopener" className="underline decoration-slate-300 underline-offset-2 hover:decoration-slate-600">
      <Mono>{account}</Mono>
    </a>
  ) : (
    <Mono>{account}</Mono>
  );
}

function Stat({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <div className="mt-1 text-lg font-semibold text-slate-900" data-testid={testId}>
        {children}
      </div>
    </Card>
  );
}

function TokenCard({ token, nowNs }: { token: TokenSummary; nowNs: bigint }) {
  const { policy, metadata, balance, budget, budgetProblem } = token;
  const fmt = (units: string | bigint) => formatAmount(units.toString(), metadata);
  const pct = budget && !budgetProblem ? usedPercent(budget) : null;
  const resetIn = budget ? Number((budgetResetNs(budget) - nowNs) / 1_000_000_000n) : null;
  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-700">
          {metadata ? metadata.symbol : "Token"} <Mono className="font-normal text-slate-500">{policy.token}</Mono>
        </h2>
        <p className="text-sm text-slate-600">
          Vault holds{" "}
          <span className="font-semibold text-slate-900" data-testid={`balance-${policy.token}`}>
            {balance === null ? "unknown" : fmt(balance)}
          </span>
        </p>
      </div>

      {budgetProblem ? (
        <div className="mt-3">
          <Notice tone="warn" title="Budget numbers from the RPC do not add up">
            <p>
              {budgetProblem}. The vault enforces its own numbers on chain, but this page will not show these. Check another RPC.
            </p>
          </Notice>
        </div>
      ) : budget && pct !== null ? (
        <div className="mt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <p>
              <span className="font-semibold" data-testid={`available-${policy.token}`}>
                {fmt(budget.available)}
              </span>{" "}
              of {fmt(budget.daily_limit)} left today
            </p>
            <p className="text-xs text-slate-500">resets {resetIn !== null ? formatRelative(resetIn) : ""} (00:00 UTC)</p>
          </div>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-label="Share of today's budget used or reserved"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <div className={`h-full ${pct >= 90 ? "bg-rose-500" : pct >= 60 ? "bg-amber-500" : "bg-emerald-600"}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {fmt(budget.executed)} paid today
            {budget.pending !== "0" ? `, ${fmt(budget.pending)} reserved for transfers in flight` : ""}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">No budget data for this token.</p>
      )}

      <dl className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-slate-500">Paid automatically up to</dt>
          <dd className="font-medium">{fmt(policy.auto_limit)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Never more than, per payment</dt>
          <dd className="font-medium">{fmt(policy.hard_tx_limit)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Daily limit (UTC day)</dt>
          <dd className="font-medium">{fmt(policy.daily_limit)}</dd>
        </div>
      </dl>
    </Card>
  );
}

interface ActivityProps {
  requests: PaymentRequest[];
  metadataFor: (token: string) => FtMetadata | null;
  nowNs: bigint;
}

function RowStatus({ request, nowNs }: { request: PaymentRequest; nowNs: bigint }) {
  return (
    <span className="flex flex-wrap gap-1">
      <StatusBadge status={request.status} />
      {isLapsed(request, nowNs) ? <Badge tone="neutral">Expired by time</Badge> : null}
    </span>
  );
}

/** Phones: one card per request, since a six-column table does not fit. */
function ActivityList({ requests, metadataFor, nowNs }: ActivityProps) {
  return (
    <ul className="space-y-2 sm:hidden" data-testid="activity-list">
      {requests.map((r) => (
        <li key={r.request_id} className="rounded-lg border border-slate-200 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <a href={requestLink(r.request_id)} className="font-mono text-sm break-all underline decoration-slate-300 underline-offset-2">
              {r.request_id}
            </a>
            <RowStatus request={r} nowNs={nowNs} />
          </div>
          <p className="mt-1 text-sm">
            <span className="font-medium">{formatAmount(r.amount, metadataFor(r.token))}</span> to <Mono>{r.recipient}</Mono>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {formatUtc(r.created_at_ns)} · <span className="font-mono">{r.reason_code}</span>
          </p>
        </li>
      ))}
    </ul>
  );
}

function ActivityTable({ requests, metadataFor, nowNs }: ActivityProps) {
  return (
    <div className="-mx-5 hidden overflow-x-auto sm:block">
      <table className="w-full min-w-[40rem] text-left text-sm" data-testid="activity">
        <thead className="text-xs text-slate-500">
          <tr className="border-b border-slate-100">
            <th className="px-5 py-2 font-medium">Requested (UTC)</th>
            <th className="px-2 py-2 font-medium">Request</th>
            <th className="px-2 py-2 font-medium">Amount</th>
            <th className="px-2 py-2 font-medium">To</th>
            <th className="px-2 py-2 font-medium">Status</th>
            <th className="px-5 py-2 font-medium">Reason</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.request_id} className="border-b border-slate-50 align-top" data-request={r.request_id}>
              <td className="whitespace-nowrap px-5 py-2 text-slate-600">{formatUtc(r.created_at_ns).replace(" UTC", "")}</td>
              <td className="px-2 py-2">
                <a href={requestLink(r.request_id)} className="font-mono text-slate-900 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-600">
                  {r.request_id}
                </a>
              </td>
              <td className="whitespace-nowrap px-2 py-2 font-medium">{formatAmount(r.amount, metadataFor(r.token))}</td>
              <td className="px-2 py-2 font-mono">{r.recipient}</td>
              <td className="px-2 py-2">
                <RowStatus request={r} nowNs={nowNs} />
              </td>
              <td className="px-5 py-2">
                <abbr title={explainReason(r.reason_code)} className="font-mono text-xs text-slate-600 no-underline">
                  {r.reason_code}
                </abbr>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Read-only overview of the vault: budgets, open requests, recent activity and the policy. */
export function Dashboard({ config }: { config: AppConfig }) {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [older, setOlder] = useState<PaymentRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setSnapshot(await loadDashboard(config, PAGE));
      setOlder([]);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  if (error && !snapshot) {
    return (
      <Notice tone="bad" title="Could not read the vault from the chain">
        <p>{error}</p>
      </Notice>
    );
  }
  if (!snapshot) return <p className="text-sm text-slate-500">Reading the vault from the chain…</p>;

  const { config: vault, policy, tokens, nowNs } = snapshot;
  const requests = [...snapshot.requests, ...older];
  const waiting = waitingForOwner(requests, nowNs);
  const metadataFor = (token: string) => tokens.find((t) => t.policy.token === token)?.metadata ?? null;
  const canLoadMore = requests.length < vault.request_count;

  const loadMore = async () => {
    try {
      setOlder([...older, ...(await listRequests(config, requests.length, PAGE))]);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <div className="space-y-6" data-testid="dashboard">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Vault overview</h1>
          <p className="text-xs text-slate-500">
            Chain time {formatUtc(nowNs.toString())}. Refreshes every {REFRESH_MS / 1000} s.
          </p>
        </div>
        <Button variant="secondary" onClick={() => void refresh()} disabled={loading} testId="refresh">
          {loading ? "Reading…" : "Refresh"}
        </Button>
      </div>

      {error ? (
        <Notice tone="bad" title="The last refresh failed; showing the previous read">
          <p>{error}</p>
        </Notice>
      ) : null}
      {vault.vault_id !== config.vaultId || vault.network !== config.network ? (
        <Notice tone="bad" title="The RPC answered for a different vault or network">
          <p>
            Expected <Mono>{config.vaultId}</Mono> on {config.network}, got <Mono>{vault.vault_id}</Mono> on {vault.network}. Do not trust these numbers.
          </p>
        </Notice>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Waiting for you" testId="waiting-count">
          {waiting.length}
          <span className="ml-1 text-xs font-normal text-slate-500">of at most {policy.max_open_approvals}</span>
        </Stat>
        <Stat label="Vault" testId="vault-state">
          {vault.paused ? <Badge tone="bad">Paused</Badge> : <Badge tone="good">Active</Badge>}
        </Stat>
        <Stat label="Policy version">{vault.policy_version}</Stat>
        <Stat label="Stored requests">{vault.request_count}</Stat>
      </div>

      {vault.paused ? (
        <Notice tone="warn" title="The vault is paused">
          <p>No new payments are accepted or executed until the owner unpauses it.</p>
        </Notice>
      ) : null}

      {tokens.map((t) => (
        <TokenCard key={t.policy.token} token={t} nowNs={nowNs} />
      ))}

      <Card>
        <h2 className="text-sm font-semibold text-slate-700">Waiting for your decision</h2>
        {waiting.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">Nothing to decide. Payments within the auto limit never wait.</p>
        ) : (
          <ul className="mt-3 space-y-2" data-testid="pending-list">
            {waiting.map((r) => (
              <li key={r.request_id}>
                <a
                  href={requestLink(r.request_id)}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 transition hover:border-slate-400 focus-visible:outline-2 focus-visible:outline-slate-700"
                >
                  <span className="min-w-0">
                    <span className="font-semibold">{formatAmount(r.amount, metadataFor(r.token))}</span> to <Mono>{r.recipient}</Mono>
                    <span className="block text-xs text-slate-500">
                      <Mono>{r.request_id}</Mono> · expires {formatRelative(Number((BigInt(r.expires_at_ns) - nowNs) / 1_000_000_000n))}
                    </span>
                  </span>
                  <StatusBadge status={r.status} />
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-700">Agent activity</h2>
          <p className="text-xs text-slate-500">
            {requests.length} of {vault.request_count} stored requests, newest first
          </p>
        </div>
        <div className="mt-3">
          {requests.length === 0 ? (
            <p className="text-sm text-slate-600">No stored requests yet.</p>
          ) : (
            <>
              <ActivityTable requests={requests} metadataFor={metadataFor} nowNs={nowNs} />
              <ActivityList requests={requests} metadataFor={metadataFor} nowNs={nowNs} />
            </>
          )}
        </div>
        {canLoadMore ? (
          <div className="mt-3">
            <Button variant="secondary" onClick={() => void loadMore()} testId="load-more">
              Show older requests
            </Button>
          </div>
        ) : null}
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Blocked requests are never stored, so they do not appear here; the vault only emits an event for them. Transaction hashes need an
          indexer, which is not built yet.
        </p>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-700">Who can do what</h2>
        <dl className="mt-3 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">Owner: approves, rejects, pauses, changes policy</dt>
            <dd>
              <AccountLink config={config} account={vault.owner} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Agents: can only request payments</dt>
            <dd className="space-y-1">
              {vault.agents.map((a) => (
                <div key={a}>
                  <AccountLink config={config} account={a} />
                </div>
              ))}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Allowed recipients</dt>
            <dd className="space-y-1" data-testid="recipients">
              {policy.recipients.map((r) => (
                <div key={r}>
                  <Mono>{r}</Mono>
                </div>
              ))}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Limits</dt>
            <dd className="text-slate-700">
              Approvals expire after {Math.round(policy.approval_ttl_sec / 60)} min. At most {policy.max_open_approvals} open approvals and{" "}
              {policy.max_requests_per_day} stored requests per day.
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-slate-500">Vault contract</dt>
            <dd>
              <AccountLink config={config} account={vault.vault_id} />
            </dd>
          </div>
        </dl>
      </Card>

      <p className="text-xs leading-relaxed text-slate-500">
        Everything here is read directly from <Mono>{config.rpcUrl}</Mono> (final blocks) and checked against the vault&apos;s formats. A
        compromised RPC could show false numbers, but it cannot make the vault pay: payments follow the contract&apos;s own state.
      </p>
    </div>
  );
}
