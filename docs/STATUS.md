# Status

Last updated 2026-10-24 (UTC). Network mode so far: **local sandbox only**. Nothing has been deployed to testnet or mainnet, and no real funds have moved.

## Milestone: AGENTS.md section 19 steps 1-5

| Step | State |
|---|---|
| 1. Verify rules and SDKs, write INTEGRATIONS.md | done; `HACKATHON.md` added from the owner's copy (live version not fetched) |
| 2. ARCHITECTURE, THREAT_MODEL, DECISIONS, STATUS | done |
| 3. Monorepo with lint/typecheck/test/build baseline | done (pnpm + cargo workspaces, CI workflow) |
| 4. Vault with owner/agent auth and policy validation, negative tests | done |
| 5. Mock NEP-141 + sandbox direct payment; reservation, failure, replay, concurrency, rollover | done (rollover in unit tests only) |
| 6. Dashboard, Telegram, wallet approval page, then P1 | approval page built and browser-tested on sandbox; dashboard, Telegram and P1 not started |

## P0 checklist (AGENTS.md section 4)

| # | Item | State |
|---|---|---|
| 1 | single owner + agent + one NEP-141 token | local tested (sandbox) |
| 2 | policy with auto, daily and per-tx limits, allowlists, pause | local tested |
| 3 | agent requests via API/MCP; contract rejects unsafe requests | contract: local tested; **API/MCP not built** |
| 4 | auto payment executes with on-chain receipt | local tested (sandbox) |
| 5 | larger payment awaits approval; Telegram notice | contract: local tested; **Telegram not built** |
| 6 | owner wallet approves the exact request; executes once | local tested in a real browser (sandbox, dev signer); wallet connector loads on a testnet build; **signing with a real wallet on testnet not yet done** |
| 7 | dashboard | open-request list only |
| 8 | Security Lab, at least 6 negative tests | 15 of 18 cases covered at contract level (see THREAT_MODEL.md); no UI |
| 9 | public app, README, video, submission | not started |

## Tests (last run 2026-10-24)

| Command | Result |
|---|---|
| `scripts/test-contracts.sh` | vault unit 51 passed; mock-ft unit 1 passed; sandbox 8 passed |
| `cargo clippy --workspace --all-targets -- -D warnings` (in `contracts/`) | clean |
| `cargo fmt --all --check` | clean |
| `pnpm lint && pnpm typecheck && pnpm test && pnpm build` | clean; shared 14 passed, web 17 passed |
| `pnpm e2e` (Chromium, local sandbox) | 7 passed: approve and pay, reject, altered recipient flagged, forged hash refused by the vault, non-owner blocked, foreign-vault link refused, open-request list |

Manual check on a testnet build: the near-connect wallet selector opens with no page errors and lists Meteor, Intear, Ledger, Nightly, Ethereum wallets and NEAR CLI (2026-10-24).

GitHub Actions `ci` run 1 (commit `8b91f83`) passed both jobs. The contracts job ran all 8 sandbox tests on the hosted runner without the rlimit shim.

Measured: an auto payment (request + ft_transfer + callback) burnt about 7 Tgas in sandbox.

## Unresolved risks

- Eligibility of code written before 2026-11-01 (DECISIONS ADR-000).
- The vault account's full-access key can redeploy the code (THREAT_MODEL).
- No reconciliation path for a stuck TRANSFER_PENDING; no storage pruning.
- Testnet/mainnet protocol support for the rustc 1.97 wasm output is unverified.
- The approval page has not signed with a real wallet yet; no CSP / frame-ancestors headers.

## Next smallest task

Deploy the vault and mock token to NEAR testnet from a machine that can reach testnet RPC, record the contract ids, code hash and one settled auto-payment transaction here, then approve a payment from the approval page with a real testnet wallet.

After that, give the agent a function-call key on its own account scoped to the vault's `request_direct_payment` and `execute_request`, and add a sandbox test that the key cannot call anything else. The security track names function-call keys as a hint, and this makes the agent's key useless outside SpendPact.
