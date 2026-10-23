# Integrations

What each external dependency is, which version is pinned, where the information came from, and when it was checked. "Verified" means checked against the package source or a running test in this repo, not recalled from memory.

## Environment used for verification (2026-10-23 UTC)

The first build session ran in a cloud container with a restricted network allowlist.

| Host | Reachable | Effect |
|---|---|---|
| `index.crates.io`, `static.crates.io` | yes | Rust crates resolved and their source read directly |
| `registry.npmjs.org` | yes | npm versions and peer dependencies checked |
| `s3-us-west-1.amazonaws.com` (`build.nearprotocol.com`) | yes | NEAR sandbox node binary downloaded |
| `raw.githubusercontent.com` | yes | GitHub Action `action.yml` files checked |
| `nearhackathon.com` | **no** | `HACKATHON.md` not fetched. Open question below. |
| `docs.near.org`, `docs.rs` | **no** | SDK behavior verified from crate source instead |
| `docs.near-intents.org`, `1click.chaindefuser.com` | **no** | 1Click not integrated or re-verified (P1) |
| `rpc.testnet.near.org` | **no** | No testnet deployment from this environment |
| `core.telegram.org` | **no** | Telegram not integrated yet |

## Rust / NEAR

| Item | Pinned | Source | Checked |
|---|---|---|---|
| Rust toolchain | 1.97.0 + `wasm32-unknown-unknown` (`contracts/rust-toolchain.toml`) | installed toolchain | 2026-10-23 |
| `near-sdk` | `=5.29.1` | crates.io index + crate source | 2026-10-23 |
| `near-contract-standards` | `=5.29.1` (mock token only) | crates.io index + crate source | 2026-10-23 |
| `near-workspaces` | `=0.23.0` (tests only) | crates.io index + crate source | 2026-10-23 |
| `near-sandbox` | 0.3.16 via near-workspaces, node binary 2.13.4 | crate source (`DEFAULT_NEAR_SANDBOX_VERSION`) | 2026-10-23 |

Facts taken from the crate sources, all exercised by passing tests:

- near-sdk 5.29.1 declares `[package.metadata.near] min_protocol_version = 84`. cargo-near-build 0.11.5 says protocol 84 (nearcore 2.12) accepts the bulk-memory opcodes rustc >= 1.87 emits. The sandbox node (2.13.4) runs the 1.97 build. **Unverified:** the protocol version of testnet and mainnet at deploy time.
- near-sdk >= 5.27 requires `--cfg near` for on-chain builds. `scripts/build-contracts.sh` passes cargo-near's default flags (`-C link-arg=-s --cfg near`) without cargo-near installed.
- `env::promise_result` is deprecated in 5.29 in favor of `promise_result_checked(idx, max_len)`. The vault uses the checked form.
- `#[private]` is enforced in the generated wasm entry point, not inside the Rust method, so unit tests cannot cover it. Sandbox test `t16_callback_cannot_be_called_from_outside` does.
- A transaction signed with a function-call access key that attaches a deposit is rejected by the protocol with `InvalidAccessKeyError(DepositWithFunctionCall)`. Observed in sandbox test `s2_approval_needs_the_owner_wallet_and_executes_once`. This is what makes the 1 yocto requirement on owner methods meaningful.
- A NEAR function-call key's `allowance` limits gas fees, not token spending (AGENTS.md section 3). SpendPact never uses it as a budget.

### Sandbox node in containers

`neard` raises `RLIMIT_NOFILE` to 65535 at startup and exits if it can't. The verification container's hard limit was 20000 and could not be raised. `scripts/test-contracts.sh` detects this and preloads `scripts/sandbox-shim/clamp_nofile.c`, which caps the request at the hard limit. It only affects local test runs.

## TypeScript

| Package | Pinned | Why this version |
|---|---|---|
| `typescript` | 6.0.3 | `typescript-eslint` 8.71.1 requires `typescript >=4.8.4 <6.1.0`, so 7.x is not usable yet |
| `typescript-eslint` | 8.71.1 | latest release at least two weeks old |
| `eslint` / `@eslint/js` | 10.12.0 / 10.0.1 | same rule |
| `vitest` | 5.0.3 | same rule; requires Node `^22.12.0 \|\| ^24 \|\| >=26` |
| `@noble/hashes` | 2.4.0 | sha256 for the request digest; v2 import paths are `@noble/hashes/sha2.js` and `/utils.js` |
| `@types/node` | 22.20.5 | matches Node 22 |

All versions were checked against `registry.npmjs.org` on 2026-10-23. The rule: newest release in the major line that is at least two weeks old.

## GitHub Actions

`actions/checkout@v6`, `actions/setup-node@v6`, `pnpm/action-setup@v5` and `Swatinem/rust-cache@v2` exist and run on `node24` (checked via their `action.yml` on 2026-10-23).

## Request digest test vector

Computed independently with Python `hashlib` and asserted in both `contracts/spendpact-vault/src/tests.rs` and `packages/shared/test/digest.test.ts`:

```text
network=sandbox vault=vault.test.near request_id=req-001 agent=agent.test.near route=NEAR_DIRECT(0)
token=token.test.near amount=25000000 recipient=api.test.near reason="pay for weather API"
expires_at_ns=1762000000000000000 policy_version=1
-> 176 bytes, sha256 = 2dc183ce79e25bd13fba4c84e703d2937d53c3cf63f5cf1056ecac3d9b57e49e
```

## Not integrated yet

| Integration | Status | Notes |
|---|---|---|
| NEAR Intents / 1Click | not started (P1) | AGENTS.md section 8 lists endpoints the owner researched on 2026-10-23. Not re-verified here because the hosts were blocked. AGENTS.md says there is no testnet version. |
| NEAR wallet connector | not started | needed for the owner approval page |
| Telegram Bot API | not started | |
| `HACKATHON.md` | not fetched | the owner must download it to the repo root |
