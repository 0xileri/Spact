import type { ReasonCode } from "./reasonCodes.js";

/** JSON shapes returned by the vault contract. Amounts and nanosecond timestamps are strings. */

export type Route = "NEAR_DIRECT";

export type Status =
  | "BLOCKED"
  | "AWAITING_APPROVAL"
  | "APPROVED"
  | "DENIED"
  | "EXPIRED"
  | "TRANSFER_PENDING"
  | "SETTLED"
  | "TRANSFER_FAILED";

export interface TokenPolicy {
  token: string;
  auto_limit: string;
  hard_tx_limit: string;
  daily_limit: string;
}

export interface Policy {
  tokens: TokenPolicy[];
  recipients: string[];
  max_open_approvals: number;
  max_requests_per_day: number;
  approval_ttl_sec: number;
}

export interface PaymentRequest {
  request_id: string;
  agent_id: string;
  route: Route;
  token: string;
  amount: string;
  recipient: string;
  reason: string;
  created_at_ns: string;
  expires_at_ns: string;
  policy_version: number;
  request_hash: string;
  status: Status;
  reason_code: ReasonCode;
  approved_by: string | null;
  reserved_day: number | null;
  updated_at_ns: string;
}

export interface PaymentOutcome {
  request_id: string;
  status: Status;
  reason_code: ReasonCode;
  request_hash: string | null;
}

export interface BudgetView {
  token: string;
  day: number;
  daily_limit: string;
  executed: string;
  pending: string;
  available: string;
}

export interface ConfigView {
  vault_id: string;
  owner: string;
  network: string;
  agents: string[];
  paused: boolean;
  policy_version: number;
  open_approvals: number;
  request_count: number;
}
