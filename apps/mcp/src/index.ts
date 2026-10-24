#!/usr/bin/env node
/**
 * SpendPact MCP server (stdio). Gives an AI agent two tools, request_payment and
 * get_payment_status, backed by the agent's function-call key. It refuses to start with a
 * full-access key, a key for another contract or extra methods, or a vault on another network.
 *
 * Configuration comes from environment variables; see apps/mcp/README.md.
 */
import { serveStdio } from "@modelcontextprotocol/server/stdio";

import { loadAgentKey } from "./agentKey.js";
import { parseConfig } from "./config.js";
import { createSpendPactServer } from "./tools.js";
import { createVaultClient } from "./vault.js";

async function main() {
  const config = parseConfig(process.env);
  const key = loadAgentKey(config.agentKeyFile, config.agentId);
  const vault = createVaultClient(config, key);
  await vault.preflight();
  console.error(
    `spendpact-mcp: ${key.accountId} (function-call key ${key.publicKey}) -> vault ${config.vaultId} on ${config.network}`,
  );

  const handle = serveStdio(() => createSpendPactServer({ vault, config }));
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => void handle.close().finally(() => process.exit(0)));
  }
}

main().catch((e: unknown) => {
  console.error(`spendpact-mcp: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
