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
| `nearhackathon.com` | **no** | The owner pasted `HACKATHON.md` into the session; it is at the repo root with a provenance note. The live version was not fetched. |
| `docs.near.org`, `docs.rs` | **no** | SDK behavior verified from crate source instead |
| `docs.near-intents.org`, `1click.chaindefuser.com` | **no** | 1Click not integrated or re-verified (P1) |
| `rpc.testnet.near.org` | **no** | No testnet deployment from this environment |
| `core.telegram.org` | **no** | Telegram not integrated yet |
| `github.com` (anonymous git) | yes | NEAR docs source cloned from `github.com/near/docs` at `04d956c` (2026-10-24), which is what docs.near.org renders |
| testnet RPCs, `testnet.nearblocks.io`, faucets | **no** | Checked 2026-10-24: `test.rpc.fastnear.com`, `rpc.testnet.near.org`, `archival-rpc.testnet.near.org`, `near-testnet.drpc.org` all unreachable. Testnet steps run on the owner's machine |

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
- Errors for a function-call key, all observed in sandbox test `t19_restricted_agent_key_can_only_request_and_execute`: another contract gives `ReceiverMismatch`, a method not in the list gives `MethodNameMismatch`, a deposit gives `DepositWithFunctionCall`, and a transfer, `AddKey` or `DeleteAccount` gives `RequiresFullAccess`. An exhausted allowance gives `NotEnoughAllowance` (`t20_agent_key_allowance_caps_gas_spending`). near-workspaces 0.23.0 builds the key with `AccessKey::function_call_access(receiver, methods, allowance)`.

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

### Approval page (checked 2026-10-24)

| Package | Pinned | Notes |
|---|---|---|
| `@hot-labs/near-connect` | 0.11.4 | Wallet connector; API read from its shipped `.d.ts`. `NearConnector({ network, features })`, `connect()`, `wallet.getAccounts()`, `wallet.signAndSendTransaction({ receiverId, actions })` with `{ type: "FunctionCall", params: { methodName, args, gas, deposit } }`. Network is only `mainnet` or `testnet`. Loads its wallet manifest from raw.githubusercontent.com at runtime. Chosen over `@near-wallet-selector/*` (last release 2025-12-04): zero dependencies and wallets run in sandboxed iframes. |
| `near-api-js` | 7.2.0 | Dev signer and browser tests only. 7.3.0+ requires Node >= 22.22.2; the build machine has 22.22.0. `new Account(id, provider, "ed25519:...")`, `account.signAndSendTransaction({ receiverId, actions, throwOnFailure })`, `actions.functionCall(method, args, gas, deposit)`. |
| `react` / `react-dom` | 19.3.0 | |
| `vite` | 8.3.4 | Pinned at the root too, so vitest does not pull a second copy. Workspace packages resolve to TypeScript source through a `spendpact-source` export condition; Vitest needs it under `ssr.resolve.conditions`. |
| `@vitejs/plugin-react` | 6.1.2 | requires vite ^8 |
| `tailwindcss` / `@tailwindcss/vite` | 4.3.3 | |
| `zod` | 4.6.5 | Gotcha: refinements still run after a failed `.regex`, so a `BigInt()` inside a refine must re-check the format first (caught by a unit test). |
| `@playwright/test` | 1.63.0 | Matches the Chromium build preinstalled in the build container (`chromium-1243`). CI installs its own browser. |

NEAR RPC facts the page relies on, observed against the sandbox node (2.13.4):

- `query` with `request_type: "call_function"` and `finality: "final"` returns `result.result` as a byte array of the JSON return value; `get_request` for an unknown id returns `null`.
- `block` with `finality: "final"` has `header.timestamp_nanosec` as a string. `header.timestamp` is a JSON number that cannot hold nanoseconds exactly, so the page ignores it.

Explorer links default to `https://testnet.nearblocks.io/txns/{hash}` and `https://nearblocks.io/txns/{hash}` (override with `VITE_EXPLORER_TX_URL`); both patterns appear in the NEAR docs. Not reachable from the build environment.

## Testnet (from the NEAR docs, `near/docs` @ `04d956c`, read 2026-10-24)

| Topic | What the docs say | Source file |
|---|---|---|
| Testnet RPC | FASTNEAR `https://test.rpc.fastnear.com` (public, free tier); NEAR `https://archival-rpc.testnet.near.org` ("severely rate limited"); dRPC `https://near-testnet.drpc.org`; Intear `https://testnet-rpc.intea.rs` | `api/rpc/providers.mdx` |
| Create an account | in a wallet from wallet.near.org (pick a `.testnet` account), or `near account create-account sponsor-by-faucet-service <name>.testnet autogenerate-new-keypair save-to-legacy-keychain network-config testnet create` | `getting-started/create-account.mdx`, `smart-contracts/quickstart.mdx`, `tools/cli.mdx` |
| Testnet NEAR and tokens | the docs faucet (NEAR only) or near-faucet.io (NEAR, USDT and more); testnet Ref Finance for testnet USDC/USDT/DAI | `getting-started/faucet.mdx` |
| Subaccounts | `near account create-account fund-myself <sub>.<parent> '<n> NEAR' autogenerate-new-keypair save-to-legacy-keychain sign-as <parent> network-config <net> sign-with-legacy-keychain send` | `web3-apps/tutorials/localnet/run.mdx` |
| Deploy + init in one transaction | `near contract deploy <id> use-file <wasm> with-init-call <method> json-args '<json>' prepaid-gas '100.0 Tgas' attached-deposit '0 NEAR' network-config <net> sign-with-legacy-keychain send` | `tools/cli.mdx`, `primitives/ft/ft.mdx` |
| Calls with a deposit | `near contract call-function as-transaction <id> <method> json-args '<json>' prepaid-gas '<n> Tgas' attached-deposit '1 yoctoNEAR' sign-as <account> network-config <net> sign-with-legacy-keychain send` | `tools/cli.mdx` |
| Localnet with near-cli-rs | add a `[network_connection.localnet-sandbox]` block (`network_name = "localnet"`, `rpc_url`) to `near-cli/config.toml`; import `test.near` from the sandbox `validator_key.json` | `web3-apps/tutorials/localnet/run.mdx` |
| Function-call keys | `receiver_id`, optional `method_names`, optional `allowance` (gas only). The allowance is charged at the buy price and credited back when the gas refund arrives. When it runs out the key cannot sign, and only a full-access key can add a new one | `protocol/accounts-contracts/access-keys.mdx` |
| Adding one with the CLI | the docs show only `add-key grant-full-access`. near-cli-rs 0.30.1 `--help` gives `near account add-key <acct> grant-function-call-access --allowance '<n> NEAR' --contract-account-id <contract> --function-names '<a>, <b>' autogenerate-new-keypair save-to-legacy-keychain network-config <net> sign-with-legacy-keychain send`. The key lands in `~/.near-credentials/<net>/<acct>/<public_key>.json`, and `sign-with-access-key-file <file>` signs with it | `tools/cli.mdx`; near-cli-rs `--help` |
| Offline key generation | `near generate-keypair save-to-file <path>` is documented, but near-cli-rs 0.30.1 (latest stable on crates.io and npm, 2026-10-24) does not have it; 0.31.0-rc.2 is newer. The deploy script works around it | `tools/cli.mdx` |
| Protocol versions | max gas per transaction is 1 PGas since protocol 83 (nearcore 2.11); features are documented up to protocol 88. No page states the live versions, so `scripts/deploy-testnet.sh` reads `protocol_version` from the RPC and refuses below 84. | `smart-contracts/anatomy/collections.mdx`, `protocol/accounts-contracts/gas-keys.mdx` |

`scripts/deploy-testnet.sh` uses only these commands. `scripts/rehearse-deploy-sandbox.sh` runs it unchanged against a fresh local node; the faucet and wallet steps cannot be rehearsed there.

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
| Telegram Bot API | not started | |

## Hackathon submission (from `HACKATHON.md`, owner copy of 2026-10-23)

- Submissions are accepted only from 2026-11-01T00:00:00Z to 2026-11-14T23:59:00Z, through `POST https://nearhackathon.com/api/applications` or the form. Outside that window the API returns 403.
- One attempt per team, no edits. The agent prints the full payload and sends only after the human confirms. The payload is never committed (it contains personal data).
- Track ids that fit SpendPact: `security` (primary, hints: agent security, function-call keys, TEE attestation) and `agents`. The human decides.
