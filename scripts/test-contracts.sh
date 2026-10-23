#!/usr/bin/env bash
# Builds the contracts, runs unit tests, then runs the NEAR sandbox tests.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
"$ROOT/scripts/build-contracts.sh"
cd "$ROOT/contracts"
cargo test -p spendpact-vault -p mock-ft

# neard asks for 65535 open files and exits if it cannot get them. Some containers cap the hard
# limit lower; there, preload a shim that clamps the request (see scripts/sandbox-shim).
hard="$(ulimit -Hn)"
if [ "$hard" != "unlimited" ] && [ "$hard" -lt 65535 ]; then
  shim="$ROOT/contracts/target/libclamp_nofile.so"
  cc -shared -fPIC -O2 -o "$shim" "$ROOT/scripts/sandbox-shim/clamp_nofile.c" -ldl
  echo "hard RLIMIT_NOFILE is $hard; running the sandbox with $shim" >&2
  export LD_PRELOAD="$shim"
fi
cargo test -p integration-tests -- --test-threads=2
