import { z } from "zod";

import { REASON_CODES, type ReasonCode } from "./reasonCodes.js";
import type { BudgetView, ConfigView, PaymentRequest, Policy, TokenPolicy } from "./types.js";

/**
 * Runtime validation for JSON returned by the vault and token contracts. Anything read over RPC
 * is untrusted until it passes these schemas.
 */

/** NEAR account id rules (2-64 chars, lowercase, `.`-separated parts). */
export const ACCOUNT_ID_RE = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;

export const accountId = z.string().min(2).max(64).regex(ACCOUNT_ID_RE, "invalid NEAR account id");

const U128_MAX = (1n << 128n) - 1n;
const U64_MAX = (1n << 64n) - 1n;
const CANONICAL_UINT = /^(0|[1-9]\d*)$/;

// zod keeps running checks after a failed regex, so each bound check re-tests the format
// before calling BigInt (which throws on input like "1.5").
const boundedUint = (max: bigint, label: string) =>
  z
    .string()
    .regex(CANONICAL_UINT, "not a canonical integer string")
    .refine((s) => !CANONICAL_UINT.test(s) || BigInt(s) <= max, `exceeds ${label}`);
const u128String = boundedUint(U128_MAX, "u128");
const u64String = boundedUint(U64_MAX, "u64");
const safeUint = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

const reasonCode = z.enum(Object.keys(REASON_CODES) as [ReasonCode, ...ReasonCode[]]);
const status = z.enum([
  "BLOCKED",
  "AWAITING_APPROVAL",
  "APPROVED",
  "DENIED",
  "EXPIRED",
  "TRANSFER_PENDING",
  "SETTLED",
  "TRANSFER_FAILED",
]);

export const paymentRequestSchema: z.ZodType<PaymentRequest> = z.object({
  request_id: z.string().min(1).max(64),
  agent_id: accountId,
  route: z.literal("NEAR_DIRECT"),
  token: accountId,
  amount: u128String,
  recipient: accountId,
  reason: z.string().max(256),
  created_at_ns: u64String,
  expires_at_ns: u64String,
  policy_version: safeUint,
  request_hash: z.string().regex(/^[0-9a-f]{64}$/, "not a sha256 hex digest"),
  status,
  reason_code: reasonCode,
  approved_by: accountId.nullable(),
  reserved_day: safeUint.nullable(),
  updated_at_ns: u64String,
});

const tokenPolicySchema: z.ZodType<TokenPolicy> = z.object({
  token: accountId,
  auto_limit: u128String,
  hard_tx_limit: u128String,
  daily_limit: u128String,
});

export const policySchema: z.ZodType<Policy> = z.object({
  tokens: z.array(tokenPolicySchema),
  recipients: z.array(accountId),
  max_open_approvals: safeUint,
  max_requests_per_day: safeUint,
  approval_ttl_sec: safeUint,
});

export const configViewSchema: z.ZodType<ConfigView> = z.object({
  vault_id: accountId,
  owner: accountId,
  network: z.string().min(1).max(32),
  agents: z.array(accountId),
  paused: z.boolean(),
  policy_version: safeUint,
  open_approvals: safeUint,
  request_count: safeUint,
});

export const budgetViewSchema: z.ZodType<BudgetView> = z.object({
  token: accountId,
  day: safeUint,
  daily_limit: u128String,
  executed: u128String,
  pending: u128String,
  available: u128String,
});

/** The fields of NEP-148 `ft_metadata` the UI needs. */
export interface FtMetadata {
  symbol: string;
  decimals: number;
}

export const ftMetadataSchema: z.ZodType<FtMetadata> = z
  .object({
    symbol: z.string().min(1).max(32),
    decimals: z.number().int().min(0).max(24),
  })
  .loose();
