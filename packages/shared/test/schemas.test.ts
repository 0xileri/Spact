import { describe, expect, it } from "vitest";

import { accountId, configViewSchema, ftMetadataSchema, paymentRequestSchema } from "../src/schemas.js";

const REQUEST = {
  request_id: "req-001",
  agent_id: "agent.test.near",
  route: "NEAR_DIRECT",
  token: "token.test.near",
  amount: "25000000",
  recipient: "api.test.near",
  reason: "pay for weather API",
  created_at_ns: "1761996400000000000",
  expires_at_ns: "1762000000000000000",
  policy_version: 1,
  request_hash: "2dc183ce79e25bd13fba4c84e703d2937d53c3cf63f5cf1056ecac3d9b57e49e",
  status: "AWAITING_APPROVAL",
  reason_code: "REQUIRES_OWNER_APPROVAL",
  approved_by: null,
  reserved_day: null,
  updated_at_ns: "1761996400000000000",
};

describe("contract JSON schemas", () => {
  it("accept a well-formed request", () => {
    expect(paymentRequestSchema.parse(REQUEST)).toEqual(REQUEST);
  });

  it("reject malformed or unexpected values", () => {
    const bad: Record<string, unknown>[] = [
      { amount: "-1" },
      { amount: "1.5" },
      { amount: "340282366920938463463374607431768211456" },
      { recipient: "Mallory.near" },
      { recipient: "a" },
      { status: "PAID" },
      { reason_code: "TRUST_ME" },
      { route: "ONE_CLICK" },
      { request_hash: "ABC" },
      { policy_version: 1.5 },
    ];
    for (const change of bad) {
      expect(paymentRequestSchema.safeParse({ ...REQUEST, ...change }).success, JSON.stringify(change)).toBe(false);
    }
  });

  it("validate account ids by NEAR rules", () => {
    for (const ok of ["ab", "alice.near", "vault.test.near", "a-b_c.testnet", "0".repeat(64)]) {
      expect(accountId.safeParse(ok).success, ok).toBe(true);
    }
    for (const bad of ["a", "Alice.near", "alice..near", ".near", "alice.near.", "a b", "x".repeat(65)]) {
      expect(accountId.safeParse(bad).success, bad).toBe(false);
    }
  });

  it("parse config and token metadata", () => {
    expect(
      configViewSchema.safeParse({
        vault_id: "vault.test.near",
        owner: "owner.test.near",
        network: "sandbox",
        agents: ["agent.test.near"],
        paused: false,
        policy_version: 1,
        open_approvals: 0,
        request_count: 0,
      }).success,
    ).toBe(true);
    expect(ftMetadataSchema.parse({ spec: "ft-1.0.0", name: "x", symbol: "TUSD", decimals: 6 })).toMatchObject({
      symbol: "TUSD",
      decimals: 6,
    });
    expect(ftMetadataSchema.safeParse({ symbol: "TUSD", decimals: 30 }).success).toBe(false);
  });
});
