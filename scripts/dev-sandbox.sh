#!/usr/bin/env bash
# Local end-to-end demo without a wallet or testnet:
#   1. a NEAR sandbox node with a funded vault and one request waiting for approval
#   2. the dev signer, which signs owner decisions with the sandbox owner key on localhost
#   3. the approval page on http://localhost:5173
#   4. the agent's MCP server, built and ready to add to Claude Code or Codex (commands printed below)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FIXTURE="$ROOT/contracts/target/sandbox-fixture.json"
AGENT_KEY="$ROOT/contracts/target/sandbox-agent-key.json"
SIGNER_PORT="${DEV_SIGNER_PORT:-8788}"
WEB_PORT="${WEB_PORT:-5173}"
rm -f "$FIXTURE" "$AGENT_KEY"

pids=()
cleanup() {
  for pid in "${pids[@]}"; do kill -INT "$pid" 2>/dev/null || true; done
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

"$ROOT/scripts/start-demo-sandbox.sh" "$FIXTURE" &
pids+=($!)
for _ in $(seq 1 120); do [ -s "$FIXTURE" ] && break; sleep 1; done
[ -s "$FIXTURE" ] || { echo "sandbox did not start" >&2; exit 1; }

field() { node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))[process.argv[2]])" "$FIXTURE" "$1"; }

(cd "$ROOT/apps/web" && DEV_SIGNER_PORT="$SIGNER_PORT" node --experimental-strip-types dev/dev-signer.ts "$FIXTURE") &
pids+=($!)

# The agent's function-call key, in near-cli's key file format, for the MCP server.
(cd "$ROOT/apps/mcp" && node --input-type=module -e '
import { readFileSync, writeFileSync } from "node:fs";
import { KeyPair } from "near-api-js";
const sk = JSON.parse(readFileSync(process.argv[1], "utf8")).agent_secret_key;
writeFileSync(process.argv[2], JSON.stringify({ public_key: KeyPair.fromString(sk).getPublicKey().toString(), private_key: sk }), { mode: 0o600 });
' "$FIXTURE" "$AGENT_KEY")
(cd "$ROOT" && pnpm -s --filter @spendpact/shared build && pnpm -s --filter @spendpact/mcp build) >&2

MCP_ENV=(
  "SPENDPACT_NETWORK=sandbox"
  "SPENDPACT_RPC_URL=$(field rpc_url)"
  "SPENDPACT_VAULT_ID=$(field vault_id)"
  "SPENDPACT_AGENT_ID=$(field agent_id)"
  "SPENDPACT_AGENT_KEY_FILE=$AGENT_KEY"
  "SPENDPACT_APPROVAL_URL=http://localhost:$WEB_PORT/"
)
echo
echo "Agent MCP server (the sandbox RPC port changes every run, so re-add it each time):"
printf '  claude mcp add spendpact'; printf ' -e %s' "${MCP_ENV[@]}"; printf ' -- node %s\n' "$ROOT/apps/mcp/dist/index.js"
printf '  codex mcp add spendpact'; printf ' --env %s' "${MCP_ENV[@]}"; printf ' -- node %s\n' "$ROOT/apps/mcp/dist/index.js"
echo "Then ask the agent to pay $(field api_id) in $(field token_id) (6 decimals): 5 TUSD is paid at once, 20 TUSD waits for you."

echo
echo "Open http://localhost:$WEB_PORT/?request=$(field demo_request_id)"
echo "Press Ctrl+C to stop everything."
echo
cd "$ROOT/apps/web"
VITE_NEAR_NETWORK=sandbox \
VITE_NEAR_RPC_URL="$(field rpc_url)" \
VITE_VAULT_ID="$(field vault_id)" \
VITE_DEV_SIGNER_URL="http://127.0.0.1:$SIGNER_PORT" \
  pnpm exec vite --port "$WEB_PORT" --strictPort
