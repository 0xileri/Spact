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

## Open questions (from AGENTS.md section 17)

- [x] Official `HACKATHON.md`: added at the repo root (owner copy, 2026-10-23).
- [ ] Eligibility of pre-window code (ADR-000).
- [ ] Demo stablecoin on testnet/mainnet: token id, decimals, storage behavior, 1Click support.
- [ ] Testnet/mainnet protocol version >= 84 for rustc 1.97 output (see INTEGRATIONS.md).
- [ ] Vault account key policy: keep offline, delete after deploy, or a controlled upgrade path.
- [ ] Reconciliation for a stuck TRANSFER_PENDING (callback out of gas).
- [ ] Storage pruning for terminal requests.
- [ ] 1Click quote authenticity and deposit semantics (P1).
- [ ] Telegram chat binding flow.
- [ ] License (MIT or Apache-2.0).
- [ ] NEAR payout account and project description for the form (owner-provided).
