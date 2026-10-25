# Decisions

Short ADRs. Each records the date, the choice, and why.

## ADR-000: Implementation started before the build window (2026-10-23)

The owner told the coding agent to start building on 2026-10-23, before the official window (2026-11-01 to 2026-11-14). The commit history shows this. AGENTS.md says not to present pre-event code as built during the event, and to verify eligibility before submitting.

`HACKATHON.md` (owner copy of 2026-10-23) gives the start as 2026-11-01 but has no explicit rule about code written earlier. The announcement says to build during the hackathon. **Open:** ask the organizers (NEAR Discord) whether pre-start code is allowed, and disclose the start date in the submission regardless.

## ADR-001: P0 supports direct NEP-141 payments on NEAR only (2026-10-23)

`Route` has a single variant, `NearDirect`. The 1Click route is a separate, owner-approved adapter (AGENTS.md section 8) and needs its own state and tests. It is not a generic withdrawal.

## ADR-002: Owner methods require exactly 1 yoctoNEAR (2026-10-23)

Function-call access keys cannot attach deposits, so `assert_one_yocto` means owner actions need a full-access key signature, typically a wallet confirmation. A function-call key the owner gave a dApp or backend cannot approve payments or change policy. Shown in sandbox (`DepositWithFunctionCall`).

## ADR-003: Build wasm with cargo flags instead of cargo-near; no wasm-opt (2026-10-23)

cargo-near was not installed in the build environment. `scripts/build-contracts.sh` uses cargo-near's default flags (`-C link-arg=-s --cfg near`), and the vault builds to about 248 KB without wasm-opt. **Revisit** before mainnet: reproducible builds (cargo-near docker) and a published code hash.

## ADR-004: Blocked requests are returned and logged, not stored (2026-10-23)

The vault pays storage for agent requests. Storing every blocked attempt would let a compromised agent drain the vault's NEAR balance through storage. Blocked requests return `BLOCKED` with a reason code and emit `request_blocked`. A blocked id can be retried because it never entered execution.

## ADR-005: Approval and execution are separate methods (2026-10-23)

`approve_request` changes no balances. `execute_request` rechecks pause, version, expiry, agent membership and budget at execution time, which is what T09 needs. A client can put both calls in one transaction when the owner wants a single signature.

## ADR-006: Policy limits (2026-10-23)

- `auto_limit` may be 0, meaning every payment needs approval. This differs from the spec's "all limits positive"; it is safe because amounts must be > 0.
- `hard_tx_limit <= daily_limit` is enforced, since a larger cap could never execute.
- Fixed bounds: 8 tokens, 64 recipients, 8 agents, 1-100 open approvals, 1-1000 stored requests per day, approval TTL of 60 seconds to 7 days.

## ADR-007: Atomic intermediate states are not stored (2026-10-23)

AUTO_AUTHORIZED -> RESERVED -> TRANSFER_PENDING happen within one receipt, so the stored status jumps straight to TRANSFER_PENDING. For direct NEAR payments SOURCE_CONFIRMED and SETTLED are the same moment, so only SETTLED is stored.

## ADR-008: Any policy change invalidates open requests (2026-10-23)

Requests record `policy_version`. Approval and execution require the current version. This is strict but simple, and it guarantees an approval never runs under limits the owner didn't see.

## ADR-009: Approval binds to a client-computed hash (2026-10-23)

The owner's client hashes the terms it displays and passes that hash to `approve_request`. Binding vault id, network and policy version into the hash covers T15. This needs no custom signature scheme: the NEAR transaction signature carries the authority.

## ADR-010: Init only by the vault account itself (2026-10-23)

`new` requires predecessor == current account, so a third party cannot initialize a deployed but uninitialized vault. Deploy and init should go in one batch transaction (as in the sandbox tests).

## ADR-011: TypeScript 6.0 (2026-10-23)

`typescript-eslint` 8.71.1 supports `typescript <6.1.0`. Move to 7.x when it is supported.

## ADR-012: Organizer rules on agent actions (2026-10-23)

`HACKATHON.md` requires explicit human confirmation before the agent submits, posts on X, makes the repo public, pushes, signs transactions, spends tokens or deploys to mainnet. This matches AGENTS.md. The owner approved pushes to the open PR branch while the agent watches it; everything else on that list still needs a fresh yes.

## ADR-013: The approval page reads the chain directly (2026-10-24)

There is no backend yet, and the approval page does not need one: it calls view methods over RPC and validates the JSON. It hashes the displayed terms with the network and vault id from its own build config, not from the RPC. A compromised RPC can mislead the owner about state, but cannot get them to approve different terms (THREAT_MODEL, approval page section).

## ADR-014: Approve and pay in one transaction by default (2026-10-24)

The page sends `approve_request` (1 yocto) and `execute_request` as two actions in one transaction, so the owner signs once. If execution fails (paused, budget), the whole transaction reverts, including the approval. Unticking "Pay immediately" sends only the approval, and the agent executes later.

## ADR-015: near-connect for wallets, a local dev signer for sandbox (2026-10-24)

`@hot-labs/near-connect` runs each wallet's code in a sandboxed iframe and has no dependencies. Wallets do not support a local sandbox, so sandbox uses `apps/web/dev/dev-signer.ts`: it holds the sandbox owner key in a separate local process, binds to 127.0.0.1, refuses non-local RPCs, and signs only approve/reject/execute calls to the demo vault with at most 1 yocto. The page refuses `VITE_DEV_SIGNER_URL` outside sandbox.

## ADR-016: Every sandbox account gets its own random key (2026-10-24)

near-workspaces gives every subaccount the same deterministic key unless one is passed. The PR #1 tests still proved the contract checks the predecessor account, but with shared keys the agent's key could also sign as the owner. `integration_tests::account` now creates each account with `SecretKey::from_random`.

## ADR-017: The agent signs with a function-call key limited to two vault methods (2026-10-24)

The agent's key can call only `request_direct_payment` and `execute_request` on the vault. The contract already checks the caller (I2, I5); the key adds a protocol-level limit, so a leaked agent key cannot transfer NEAR, add keys, delete the account, attach the 1 yocto owner methods need, or call any other contract or vault method (sandbox `t19_*`).

In sandbox tests `t19_*` and `t20_*` and in the local demo, the agent's full-access key is deleted. On testnet, `scripts/deploy-testnet.sh` adds the function-call key, writes it to a separate file for the agent runtime, and leaves the full-access key in the operator's keychain. The allowance is a gas budget that only goes down, and once it runs out only a full-access key can add a new key (NEAR docs, `protocol/accounts-contracts/access-keys.mdx`). Default allowance: 0.25 NEAR. In the deploy rehearsal, two requests (one paid, one waiting for approval) used 0.00092 NEAR of it. Whether to delete the full-access key on mainnet is open.

## ADR-018: The agent's MCP server (2026-10-24)

`apps/mcp` is a local stdio server with exactly the two tools AGENTS.md section 9 names.

- **SDK:** `@modelcontextprotocol/server` 2.3.1, the v2 line the SDK repo calls stable. Over stdio it serves both 2025-era clients (`initialize`) and 2026-07-28 clients. 2.4.0 came out the day before this decision, so the pin is the previous release.
- **Names:** `request_payment` and `get_payment_status`, without the `spact.` prefix in AGENTS.md. The server is named `spact`, and hosts already prefix tool names with the server name (Claude Code shows `mcp__spact__request_payment`).
- **Key:** the server signs with the agent's function-call key (ADR-017). It reads the key's permission from chain at startup and before every request, and refuses a full-access key, a key for another contract, a key with extra methods, a vault on another network, or an agent the vault does not list. The vault enforces the policy regardless.
- **Finality:** it waits for `FINAL` before answering, so a reported `SETTLED` is in final blocks. A sandbox test caught the earlier optimistic answer running ahead of final reads.
- **Untrusted text:** tool results use fixed sentences and reason-code explanations. The agent's `reason` goes to the owner and is never echoed back to the model.
- **No execute tool yet:** if the owner approves without paying (ADR-014, "Pay immediately" unticked), the agent cannot execute through MCP. The key allows `execute_request` for when that tool is added.

## ADR-019: The project is renamed Spact (2026-10-24)

The owner renamed the project from SpendPact to Spact and the GitHub repo to `0xileri/Spact`. Nothing is deployed yet, so the rename covers the on-chain identifiers too: the request-hash domain is now `spact.request.v1` (new test vector in INTEGRATIONS.md, recomputed with Python `hashlib`), the NEP-297 event standard is `spact`, and the transfer memos are `spact:<request_id>`. Packages are `@spact/*`, the crate is `spact-vault`, MCP environment variables are `SPACT_*`, and the MCP server is named `spact`. `HACKATHON.md` is the organizer's text and is unchanged. After a deploy, changing the hash domain or event standard would break approvals and indexers, so later renames should stay cosmetic.

## ADR-020: Telegram alerts from a polling notifier with no webhook (2026-10-24)

`apps/notifier` is a small Node process the owner runs. It polls the vault over RPC and sends Bot API `sendMessage` calls. AGENTS.md puts notifications in the Hono API on Workers, and that API is not built. The notifier is the smallest piece that delivers the alert, and it can move into the API later.

- **No webhook:** updates are read with `getUpdates` only while a chat is being linked. With no public endpoint there is no webhook secret to verify (AGENTS.md section 7, bot hardening).
- **Binding:** the notifier prints a one-time code (12 random characters, valid 10 minutes) on its own terminal. Only a private chat that sends exactly `/start <code>` is bound. This proves control of the machine running the notifier, which holds the bot token. It does not prove control of the owner wallet; a wallet-signed binding (NEP-413) is open. The bot cannot approve or move anything, so a wrong binding leaks alerts but cannot pay.
- **Message safety:** plain text with no `parse_mode`. The agent's note is labeled, cleaned and has its links defanged, so the approval link is the only link. URL buttons only for https links.
- **Scanning:** `list_requests` is newest first, so new requests are found from `request_count`, read before and after listing (the vault never removes requests). A first version assumed oldest-first and missed requests after the first pass. The sandbox test caught that.
- **Idempotency:** state is saved after each message. A crash between the send and the save can repeat one alert, never skip one.
- **Telegram API:** the Bot API docs and API were unreachable from the build environment. Request and response shapes were taken from Telegram's Bot API server source, and the client is tested against a mock. Real delivery is untested.

## ADR-021: The dashboard reads the chain directly, and shows no transaction hashes (2026-10-24)

The dashboard at `/` replaces the open-request list. Like the approval page (ADR-013), it reads the vault over RPC with no backend: `get_config`, `get_policy`, `list_requests` (50 at a time, newest first), and per token `get_budget`, `ft_metadata` and `ft_balance_of` for the vault. It shows no transaction hashes per request, because the vault does not store them and no indexer exists yet. It says so instead of guessing. Blocked requests are never stored, so they appear only as events, and the page says that too. Account links use the nearblocks address pattern from the NEAR docs; sandbox has none.

## ADR-022: The Security Lab report is generated from test runs, and the page re-derives it (2026-10-24)

AGENTS.md wants published results "generated by CI not editable by agent". The only hand-written part is the catalog (`packages/security-lab/src/catalog.ts`): which tests back which case. The generator reads raw runner output (libtest text, vitest and Playwright JSON reporters) and hashes each file. It writes `security-report.json` with the run, the commit and the toolchain, and exits non-zero if any named test failed or did not run. In CI the `security-report` job builds it from the other jobs' artifacts, and it runs even when a test job failed, so failures show up in it.

The report is never committed (gitignored). The page loads it from next to itself (`VITE_SECURITY_REPORT_URL`), validates it, and recomputes every status from its evidence. "Passed on a local chain" requires a test that runs on a NEAR node; unit tests alone show as "Passed in unit tests". A local run is labeled "not from CI, unverified". CI publishes the page with its own report (ADR-023).

## ADR-023: The site is published to GitHub Pages from main, with a frame guard instead of headers (2026-10-24)

AGENTS.md allows "Cloudflare Pages or another free static frontend tier". GitHub Pages needs no account, token or secret beyond the repository: the `pages` job in `ci.yml` runs on a push to main after every other job passed, builds `apps/web`, adds the `security-report.json` the `security-report` job just built, and deploys with `actions/deploy-pages`. So the published report always belongs to the published commit, and nobody can upload a report by hand. Vite builds with `base: "./"`, so one build works at `/` and under `/Spact/`; links are relative (`?page=security`, `?request=`).

No vault is deployed yet, so an empty `VITE_VAULT_ID` now builds a Security Lab-only site: the overview and approval links say that no vault is connected, and no wallet or RPC is touched. A malformed id is still an error. When the testnet vault exists, the repository variables `VITE_VAULT_ID`, and optionally `VITE_NEAR_NETWORK` and `VITE_NEAR_RPC_URL`, turn on the full site with no code change.

GitHub Pages cannot send response headers, so there is no `frame-ancestors` header. Instead, the page draws nothing but a notice and a new-tab link when it is inside a frame (`window.top !== window.self`). A frame that blocks scripts gets an empty page, since everything is rendered by script. The page sets no Content-Security-Policy either. A `<meta>` policy cannot carry `frame-ancestors`, and near-connect runs wallet code in `srcdoc` iframes, which inherit the page's policy, so a strict one could break the wallets, and real wallet signing cannot be tested from the build environment. The cost: an embedding wallet browser cannot frame Spact. Moving to Cloudflare Pages would allow real headers.

## ADR-024: A landing page at /, and a brand built on the three outcomes (2026-10-25)

Visitors and judges land on `/`, which used to open the owner dashboard with no explanation. `/` is now a landing page: what Spact is; the three outcomes in the configured vault's own limits, read from its policy so the page cannot overstate them; how it works; live numbers read from chain; and the Security Lab counts from the CI-built report. The dashboard moved to `?page=overview`. Approval links (`?request=`) are unchanged, so links from Telegram and the MCP server keep working. Claims on the page are backed elsewhere: "the agent cannot move funds by itself" by ADR-017 and the `t19`/`t20` sandbox tests.

The brand is ink on paper, with the outcomes as signal colors: paid (emerald), waits (amber), blocked (rose), the same hues the status badges already used. The logo is a gate: two posts and a payment passing between them. The display font is Space Grotesk (OFL-1.1), bundled from `@fontsource-variable/space-grotesk` 5.3.0, so the site still makes no request outside its own origin. The PNG icons and the share card are rendered from HTML by `apps/web/dev/render-brand.ts`. Share cards need absolute image URLs, so `VITE_SITE_URL` (set by CI from `actions/configure-pages`) adds those tags at build time; without it they are left out, and a bad value fails the build.

## Open questions (from AGENTS.md section 17)

- [x] Official `HACKATHON.md`: added at the repo root (owner copy, 2026-10-23).
- [ ] Eligibility of pre-window code (ADR-000).
- [ ] Demo stablecoin on testnet/mainnet: token id, decimals, storage behavior, 1Click support.
- [ ] Mainnet protocol version >= 84 for rustc 1.97 output (see INTEGRATIONS.md). Testnet: protocol 88, and the vault runs there (2026-10-25).
- [ ] Vault account key policy: keep offline, delete after deploy, or a controlled upgrade path.
- [ ] Agent account full-access key on mainnet: keep offline (testnet choice, ADR-017) or delete it and plan allowance top-ups.
- [ ] Reconciliation for a stuck TRANSFER_PENDING (callback out of gas).
- [ ] Storage pruning for terminal requests.
- [ ] 1Click quote authenticity and deposit semantics (P1).
- [x] Telegram chat binding flow: one-time code on the operator's terminal (ADR-020). Open: a wallet-signed binding.
- [x] Hosting: GitHub Pages from main, with the CI-built report (ADR-023). Open: a Content-Security-Policy, and real `frame-ancestors` headers, which need another host.
- [ ] A trusted RPC endpoint for testnet/mainnet. The site uses `https://test.rpc.fastnear.com` on testnet for now.
- [ ] Reproducible vault build, so anyone can match the deployed code hash to the source (STATUS: "Build reproducibility").
- [ ] License (MIT or Apache-2.0).
- [ ] NEAR payout account and project description for the form (owner-provided).
