import {
  budgetViewSchema,
  configViewSchema,
  finalBlockTimestampNs,
  ftMetadataSchema,
  parseU128,
  paymentRequestSchema,
  policySchema,
  viewFunction,
  type BudgetView,
  type ConfigView,
  type FtMetadata,
  type PaymentRequest,
  type Policy,
  type TokenPolicy,
} from "@spact/shared";

import type { AppConfig } from "../config.js";
import { budgetProblem, type TokenSummary } from "../dashboard.js";

/** Everything the approval page needs, read from chain in one go. */
export interface VaultSnapshot {
  config: ConfigView;
  policy: Policy;
  request: PaymentRequest | null;
  budget: BudgetView | null;
  /** null when the token's metadata could not be read or validated. */
  token: FtMetadata | null;
  nowNs: bigint;
}

export async function loadSnapshot(cfg: AppConfig, requestId: string): Promise<VaultSnapshot> {
  const [configRaw, policyRaw, requestRaw, nowNs] = await Promise.all([
    viewFunction(cfg.rpcUrl, cfg.vaultId, "get_config"),
    viewFunction(cfg.rpcUrl, cfg.vaultId, "get_policy"),
    viewFunction(cfg.rpcUrl, cfg.vaultId, "get_request", { request_id: requestId }),
    finalBlockTimestampNs(cfg.rpcUrl),
  ]);
  const config = configViewSchema.parse(configRaw);
  const policy = policySchema.parse(policyRaw);
  const request = requestRaw === null ? null : paymentRequestSchema.parse(requestRaw);

  let budget: BudgetView | null = null;
  let token: FtMetadata | null = null;
  if (request) {
    const [budgetRaw, metadataRaw] = await Promise.all([
      viewFunction(cfg.rpcUrl, cfg.vaultId, "get_budget", { token: request.token }),
      viewFunction(cfg.rpcUrl, request.token, "ft_metadata").catch(() => null),
    ]);
    budget = budgetRaw === null ? null : budgetViewSchema.parse(budgetRaw);
    const parsed = ftMetadataSchema.safeParse(metadataRaw);
    token = parsed.success ? parsed.data : null;
  }
  return { config, policy, request, budget, token, nowNs };
}

/** A page of stored requests, newest first (the vault's order). */
export async function listRequests(cfg: AppConfig, fromIndex: number, limit: number): Promise<PaymentRequest[]> {
  const raw = await viewFunction(cfg.rpcUrl, cfg.vaultId, "list_requests", { from_index: fromIndex, limit });
  if (!Array.isArray(raw)) throw new Error("list_requests did not return an array");
  return raw.map((r) => paymentRequestSchema.parse(r));
}

export interface DashboardSnapshot {
  config: ConfigView;
  policy: Policy;
  tokens: TokenSummary[];
  /** The newest requests, newest first. */
  requests: PaymentRequest[];
  nowNs: bigint;
}

async function tokenSummary(cfg: AppConfig, policy: TokenPolicy): Promise<TokenSummary> {
  const [budgetRaw, metadataRaw, balanceRaw] = await Promise.all([
    viewFunction(cfg.rpcUrl, cfg.vaultId, "get_budget", { token: policy.token }),
    viewFunction(cfg.rpcUrl, policy.token, "ft_metadata").catch(() => null),
    viewFunction(cfg.rpcUrl, policy.token, "ft_balance_of", { account_id: cfg.vaultId }).catch(() => null),
  ]);
  const budget = budgetRaw === null ? null : budgetViewSchema.parse(budgetRaw);
  const metadata = ftMetadataSchema.safeParse(metadataRaw);
  let balance: bigint | null;
  try {
    balance = typeof balanceRaw === "string" ? parseU128(balanceRaw) : null;
  } catch {
    balance = null; // not a u128 string: show "unknown" rather than a wrong number
  }
  return {
    policy,
    metadata: metadata.success ? metadata.data : null,
    balance,
    budget,
    budgetProblem: budget ? budgetProblem(budget, policy) : null,
  };
}

/** Everything the dashboard shows, read from chain and validated. */
export async function loadDashboard(cfg: AppConfig, requestLimit: number): Promise<DashboardSnapshot> {
  const [configRaw, policyRaw, requests, nowNs] = await Promise.all([
    viewFunction(cfg.rpcUrl, cfg.vaultId, "get_config"),
    viewFunction(cfg.rpcUrl, cfg.vaultId, "get_policy"),
    listRequests(cfg, 0, requestLimit),
    finalBlockTimestampNs(cfg.rpcUrl),
  ]);
  const config = configViewSchema.parse(configRaw);
  const policy = policySchema.parse(policyRaw);
  const tokens = await Promise.all(policy.tokens.map((t) => tokenSummary(cfg, t)));
  return { config, policy, tokens, requests, nowNs };
}

export async function getRequest(cfg: AppConfig, requestId: string): Promise<PaymentRequest | null> {
  const raw = await viewFunction(cfg.rpcUrl, cfg.vaultId, "get_request", { request_id: requestId });
  return raw === null ? null : paymentRequestSchema.parse(raw);
}

/** Polls get_request until `done` accepts the request or the timeout passes. Returns the last state seen. */
export async function waitForRequest(
  cfg: AppConfig,
  requestId: string,
  done: (r: PaymentRequest) => boolean,
  timeoutMs = 60_000,
  intervalMs = 1_000,
): Promise<PaymentRequest | null> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const last = await getRequest(cfg, requestId);
    if ((last && done(last)) || Date.now() >= deadline) return last;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
