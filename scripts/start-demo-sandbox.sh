#!/usr/bin/env bash
# Builds the contracts and the demo binary, then runs demo-sandbox in the foreground.
# Usage: scripts/start-demo-sandbox.sh <fixture.json>
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FIXTURE="${1:?usage: start-demo-sandbox.sh <fixture.json>}"
"$ROOT/scripts/build-contracts.sh" >&2
(cd "$ROOT/contracts" && cargo build -q -p integration-tests --bin demo-sandbox) >&2

# shellcheck source=sandbox-env.sh
source "$ROOT/scripts/sandbox-env.sh"
exec env ${SANDBOX_LD_PRELOAD:+LD_PRELOAD="$SANDBOX_LD_PRELOAD"} "$ROOT/contracts/target/debug/demo-sandbox" "$FIXTURE"
