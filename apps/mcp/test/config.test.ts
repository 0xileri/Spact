import { describe, expect, it } from "vitest";

import { explorerTxLink, parseConfig, reviewLink } from "../src/config.js";

const base = {
  SPENDPACT_NETWORK: "testnet",
  SPENDPACT_RPC_URL: "https://rpc.example",
  SPENDPACT_VAULT_ID: "vault.demo.testnet",
  SPENDPACT_AGENT_ID: "agent.demo.testnet",
  SPENDPACT_AGENT_KEY_FILE: "/keys/agent.json",
};

describe("parseConfig", () => {
  it("reads a testnet setup and fills in the explorer", () => {
    const cfg = parseConfig({ ...base, SPENDPACT_APPROVAL_URL: "https://approve.example/" });
    expect(cfg).toMatchObject({
      network: "testnet",
      vaultId: "vault.demo.testnet",
      agentId: "agent.demo.testnet",
      approvalUrl: "https://approve.example/",
      explorerTxUrl: "https://testnet.nearblocks.io/txns/{hash}",
    });
    expect(parseConfig({ ...base, SPENDPACT_NETWORK: "sandbox", SPENDPACT_RPC_URL: "http://127.0.0.1:3030" }).explorerTxUrl).toBeNull();
  });

  it("refuses unsafe or incomplete setups", () => {
    expect(() => parseConfig({ ...base, SPENDPACT_NETWORK: "devnet" })).toThrow(/SPENDPACT_NETWORK/);
    expect(() => parseConfig({ ...base, SPENDPACT_NETWORK: "mainnet" })).toThrow(/ENABLE_MAINNET_TRANSFERS/);
    expect(parseConfig({ ...base, SPENDPACT_NETWORK: "mainnet", ENABLE_MAINNET_TRANSFERS: "true" }).network).toBe("mainnet");
    expect(() => parseConfig({ ...base, SPENDPACT_RPC_URL: "http://rpc.example" })).toThrow(/https/);
    expect(() => parseConfig({ ...base, SPENDPACT_VAULT_ID: "Not An Account" })).toThrow(/SPENDPACT_VAULT_ID/);
    expect(() => parseConfig({ ...base, SPENDPACT_AGENT_ID: base.SPENDPACT_VAULT_ID })).toThrow(/must not be the vault/);
    expect(() => parseConfig({ ...base, SPENDPACT_AGENT_KEY_FILE: "" })).toThrow(/SPENDPACT_AGENT_KEY_FILE/);
    expect(() => parseConfig({ ...base, SPENDPACT_APPROVAL_URL: "https://a.example/?request=x" })).toThrow(/query/);
    expect(() => parseConfig({ ...base, SPENDPACT_EXPLORER_TX_URL: "https://x.example/tx" })).toThrow(/\{hash\}/);
  });
});

describe("links", () => {
  it("builds the approval page link the web app routes", () => {
    expect(reviewLink({ approvalUrl: "https://approve.example/" }, "pay:1")).toBe("https://approve.example/?request=pay%3A1");
    expect(reviewLink({ approvalUrl: null }, "pay-1")).toBeNull();
  });

  it("links only well-formed transaction hashes", () => {
    const cfg = { explorerTxUrl: "https://testnet.nearblocks.io/txns/{hash}" };
    const hash = "2Ycco1B9UE1X3wq1E7sNCbGDzfAwe2RK5nqvpKTnfzWH";
    expect(explorerTxLink(cfg, hash)).toBe(`https://testnet.nearblocks.io/txns/${hash}`);
    expect(explorerTxLink(cfg, "../../evil")).toBeNull();
    expect(explorerTxLink({ explorerTxUrl: null }, hash)).toBeNull();
  });
});
