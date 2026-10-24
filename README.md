# SpendPact

*Autonomous spending. Human rules.*

SpendPact is a payment-policy firewall for AI agents on NEAR. An agent asks a NEAR vault contract to pay someone. The contract enforces the owner's limits on-chain. Anything above the auto limit waits until the owner approves that exact payment from their wallet.

> **Unaudited hackathon prototype.** Local sandbox only so far. Do not use with real funds.

## Why not just give the agent a wallet

A wallet key can spend everything. A NEAR function-call key restricts which methods can be called, but its `allowance` caps gas, not dollars. SpendPact puts the rules in a contract the agent cannot change:

- **on-chain budgets:** per-payment auto limit, hard cap, and a UTC-day budget that counts in-flight transfers, so parallel requests cannot overspend
- **approval bound to exact terms:** the owner approves a hash of the stored request (recipient, amount, token, vault, network, policy version), signed with a full-access key. A backend or bot that shows different terms produces a hash the vault rejects.
- **no replay:** each request id executes at most once; the transfer callback settles exactly once
- **tests that attack it:** a Security Lab suite runs the bypass attempts against a real local NEAR node

## What works today

| Piece | State |
|---|---|
| Vault contract (`contracts/spendpact-vault`) | built, 51 unit tests |
| Real-chain tests on a NEAR sandbox node (`contracts/integration-tests`) | 8 passing: auto payment, approval flow, parallel split, failed transfer, private callback, agent bypass attempts, init front-run, pause/recovery |
| Shared TS package: request hash, exact amounts, contract JSON schemas, reason codes (`packages/shared`) | built, 14 tests; hash matches Rust and an independent Python vector |
| Owner approval page (`apps/web`) | built, 17 unit tests and 7 browser tests on a local chain, including a tampered RPC |
| Local demo with no wallet or testnet needed (`scripts/dev-sandbox.sh`) | works |
| Testnet deployment, signing with a real wallet | not yet |
| Dashboard, Telegram, MCP tool | not yet (an open-request list exists) |
| NEAR Intents / 1Click cross-chain route | not yet (P1) |

Details: [docs/STATUS.md](docs/STATUS.md). Security mapping: [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md).

## Try the approval flow locally

No wallet, testnet or funds needed. One command starts a local NEAR chain with a funded vault, a local signer holding the sandbox owner key, and the approval page.

```bash
pnpm install --frozen-lockfile
scripts/dev-sandbox.sh
```

1. Wait for `Open http://localhost:5173/?request=demo-approve-1` and open it. You see **25 TUSD to api.test.near**, status **Awaiting approval**, the agent's note, the policy (auto up to 10 TUSD, at most 30 TUSD per payment, **47 TUSD of 50** left today), and a green **Hash check passed** box.
2. Click **Connect Local sandbox signer**. The header shows `owner.test.near`.
3. Click **Approve and pay**. You see **Confirmed on chain: approved and paid** with a transaction hash, the status turns **Paid**, and the budget drops to **22 TUSD of 50**.
4. Open http://localhost:5173/. The demo request is gone from **Waiting for your decision**.

To watch the attacks fail, run `pnpm e2e`. It drives Chromium against the same local setup, and you see `7 passed`. Two of those tests rewrite the RPC response on its way to the page:

- **Recipient changed, hash kept:** the page shows **Hash check failed: do not approve** and the approve button is disabled.
- **Recipient and hash both forged:** the page shows the attacker's terms with a passing check, the owner approves, and the vault refuses with `HASH_MISMATCH`. The test then reads the chain directly: nothing moved and the request still awaits approval.

## Run the tests

Prerequisites: rustup (run `rustup toolchain install` inside `contracts/` to get the pinned 1.97.0 toolchain and wasm target), Node 22.12+, pnpm 10, and a C compiler (only used in containers with a low open-file limit).

```bash
# contracts: build wasm, unit tests, then sandbox tests on a local NEAR node
scripts/test-contracts.sh

# TypeScript
pnpm install --frozen-lockfile
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Expected: `51 passed` (vault unit), `1 passed` (mock token), `8 passed` (sandbox), `14 passed` (shared) and `17 passed` (web). The first sandbox run downloads the NEAR sandbox node binary.

On testnet or mainnet the page uses a real wallet through near-connect. Configure it with `apps/web/.env.example`.

## NEAR technology used

- **NEAR smart contract** (Rust, near-sdk 5.29.1): policy, budgets, approvals, the request state machine
- **NEP-141** fungible tokens: the vault pays with `ft_transfer` and checks the result in a private callback
- **Access keys:** owner actions require 1 yoctoNEAR, which function-call keys cannot attach, so only a full-access (wallet) signature can approve or change policy. The protocol rejects the attempt with `DepositWithFunctionCall`, as a sandbox test shows.
- **NEP-297 events** for every state change
- **NEAR Connect** (`@hot-labs/near-connect`) for owner wallets on testnet and mainnet, with each wallet's code in a sandboxed iframe
- **NEAR JSON-RPC**: the approval page reads the vault directly, with no backend in between

NEAR Intents is planned for a human-approved cross-chain payout (P1) and is not integrated yet.

## Repo map

```text
AGENTS.md                 canonical product + security spec (read first)
contracts/                Rust workspace: vault, mock token, sandbox tests
apps/web/                 owner approval page, dev signer, browser tests
packages/shared/          TS types, request digest, amount helpers, JSON schemas
scripts/                  build and test scripts
docs/                     architecture, threat model, decisions, status, integrations
```
