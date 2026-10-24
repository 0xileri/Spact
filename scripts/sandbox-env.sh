# Sourced by scripts that start the NEAR sandbox node. Expects ROOT to be the repo root.
#
# neard asks for 65535 open files and exits if it cannot get them. Some containers cap the hard
# limit lower; there, this builds scripts/sandbox-shim and sets SANDBOX_LD_PRELOAD to it.
SANDBOX_LD_PRELOAD=""
_hard_nofile="$(ulimit -Hn)"
if [ "$_hard_nofile" != "unlimited" ] && [ "$_hard_nofile" -lt 65535 ]; then
  SANDBOX_LD_PRELOAD="$ROOT/contracts/target/libclamp_nofile.so"
  mkdir -p "$ROOT/contracts/target"
  cc -shared -fPIC -O2 -o "$SANDBOX_LD_PRELOAD" "$ROOT/scripts/sandbox-shim/clamp_nofile.c" -ldl
  echo "hard RLIMIT_NOFILE is $_hard_nofile; running the sandbox with $SANDBOX_LD_PRELOAD" >&2
fi
