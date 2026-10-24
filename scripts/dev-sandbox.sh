#!/usr/bin/env bash
# Local end-to-end demo without a wallet or testnet:
#   1. a NEAR sandbox node with a funded vault and one request waiting for approval
#   2. the dev signer, which signs owner decisions with the sandbox owner key on localhost
#   3. the approval page on http://localhost:5173
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FIXTURE="$ROOT/contracts/target/sandbox-fixture.json"
SIGNER_PORT="${DEV_SIGNER_PORT:-8788}"
WEB_PORT="${WEB_PORT:-5173}"
rm -f "$FIXTURE"

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
