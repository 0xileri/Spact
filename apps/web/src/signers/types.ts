import type { FunctionCallAction } from "../approval.js";

export interface SignResult {
  txHash: string | null;
}

/** Something that can sign a transaction as the vault owner. Never holds keys in this page. */
export interface OwnerSigner {
  readonly label: string;
  /** Account from an earlier session, if the signer remembers one. */
  restore(): Promise<string | null>;
  connect(): Promise<string>;
  disconnect(): Promise<void>;
  signAndSend(receiverId: string, actions: FunctionCallAction[]): Promise<SignResult>;
}

export class SignError extends Error {
  constructor(
    message: string,
    readonly txHash: string | null = null,
  ) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Pulls the transaction hash out of a NEAR final execution outcome. */
export function txHashOf(outcome: unknown): string | null {
  if (!isRecord(outcome)) return null;
  const tx = outcome.transaction;
  if (isRecord(tx) && typeof tx.hash === "string") return tx.hash;
  const txOutcome = outcome.transaction_outcome;
  if (isRecord(txOutcome) && typeof txOutcome.id === "string") return txOutcome.id;
  return null;
}

/** Returns the failure description of a NEAR final execution outcome, or null if it succeeded. */
export function failureOf(outcome: unknown): string | null {
  if (!isRecord(outcome)) return "the wallet returned no outcome";
  const status = outcome.status;
  if (isRecord(status) && "Failure" in status) return JSON.stringify(status.Failure);
  return null;
}
