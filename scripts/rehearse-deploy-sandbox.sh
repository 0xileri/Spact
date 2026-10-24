#!/usr/bin/env bash
# Dress rehearsal for scripts/deploy-testnet.sh: runs it unchanged against a fresh local sandbox node,
# then checks the resulting chain state. Testnet-only steps (faucet, wallet) are not covered.
#
# Needs near-cli-rs and the sandbox binary that scripts/test-contracts.sh downloads.
# near-cli-rs runs with a throwaway HOME and config, so your real ~/.near-credentials is untouched.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
RPC="http://127.0.0.1:3030"
SANDBOX_BIN="$(ls "$ROOT"/contracts/target/debug/build/near-sandbox-*/out/.near/near-sandbox-*/near-sandbox 2>/dev/null | head -1 || true)"
[ -x "$SANDBOX_BIN" ] || { echo "sandbox binary not found: run scripts/test-contracts.sh first" >&2; exit 1; }

NEAR_BIN="$(command -v near)"
near() { HOME="$WORK" XDG_CONFIG_HOME="$WORK/.config" "$NEAR_BIN" "$@"; }
export -f near
export WORK NEAR_BIN

# shellcheck source=sandbox-env.sh
source "$ROOT/scripts/sandbox-env.sh"
PRELOAD=(${SANDBOX_LD_PRELOAD:+LD_PRELOAD="$SANDBOX_LD_PRELOAD"})
env "${PRELOAD[@]}" "$SANDBOX_BIN" --home "$WORK/sandbox" init >"$WORK/sandbox-init.log" 2>&1 \
  || { cat "$WORK/sandbox-init.log" >&2; exit 1; }
# `env` execs the node, so $! is the node itself and the EXIT trap's SIGINT reaches it.
env "${PRELOAD[@]}" "$SANDBOX_BIN" --home "$WORK/sandbox" run >"$WORK/sandbox.log" 2>&1 &
SANDBOX_PID=$!
trap 'kill -INT $SANDBOX_PID 2>/dev/null || true; wait $SANDBOX_PID 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do curl -sf "$RPC/status" >/dev/null && break; sleep 1; done
curl -sf "$RPC/status" >/dev/null || { echo "sandbox did not start; see $WORK/sandbox.log" >&2; exit 1; }

# near-cli connection for the local node (docs: tools/cli "Localnet configuration values").
near config show-connections >/dev/null
cat >>"$WORK/.config/near-cli/config.toml" <<EOF

[network_connection.localnet-sandbox]
network_name = "localnet"
rpc_url = "$RPC/"
wallet_url = "http://localhost/"
explorer_transaction_url = "http://localhost/"
EOF

# Import the sandbox root account test.near into the legacy keychain.
node -e '
const fs = require("fs");
const k = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
fs.mkdirSync(process.argv[2], { recursive: true });
fs.writeFileSync(`${process.argv[2]}/${k.account_id}.json`, JSON.stringify({ account_id: k.account_id, public_key: k.public_key, private_key: k.secret_key }));
' "$WORK/sandbox/validator_key.json" "$WORK/.near-credentials/localnet"

# Stand-in for the owner's wallet account.
near account create-account fund-myself owner.test.near '5 NEAR' autogenerate-new-keypair save-to-legacy-keychain \
  sign-as test.near network-config localnet-sandbox sign-with-legacy-keychain send

NETWORK_CONFIG=localnet-sandbox NETWORK_LABEL=sandbox RPC_URL="$RPC" "$ROOT/scripts/deploy-testnet.sh" test.near owner.test.near

echo
echo "==> Checking chain state"
node --input-type=module -e '
const rpc = process.argv[1];
async function view(contract, method, args) {
  const res = await fetch(rpc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
    jsonrpc: "2.0", id: "x", method: "query",
    params: { request_type: "call_function", finality: "final", account_id: contract, method_name: method,
              args_base64: Buffer.from(JSON.stringify(args)).toString("base64") } }) });
  const body = await res.json();
  return JSON.parse(Buffer.from(body.result.result).toString());
}
const checks = [
  ["vault owner", (await view("vault.test.near", "get_config", {})).owner, "owner.test.near"],
  ["vault network", (await view("vault.test.near", "get_config", {})).network, "sandbox"],
  ["auto payment", (await view("vault.test.near", "get_request", { request_id: "demo-auto-1" })).status, "SETTLED"],
  ["approval request", (await view("vault.test.near", "get_request", { request_id: "demo-approve-1" })).status, "AWAITING_APPROVAL"],
  ["payee balance", await view("tusd.test.near", "ft_balance_of", { account_id: "api.test.near" }), "3000000"],
  ["vault balance", await view("tusd.test.near", "ft_balance_of", { account_id: "vault.test.near" }), "997000000"],
];
let failed = 0;
for (const [name, got, want] of checks) {
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${got}${ok ? "" : ` (expected ${want})`}`);
}
process.exit(failed ? 1 : 0);
' "$RPC"
