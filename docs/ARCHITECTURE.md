# Architecture

Status labels: **built** (code plus passing tests in this repo), **planned** (in AGENTS.md, no code yet).

```text
                    HUMAN OWNER  (NEAR wallet, full-access key)
                         | set_policy / set_paused / approve_request(id, hash)
                         | reject_request / owner_withdraw        [built, contract side]
                         v
 AI AGENT --request_direct_payment / execute_request--> SPENDPACT VAULT (Rust, near-sdk)  [built]
 (own NEAR account,                                     - policy + version
  restricted key)                                       - immutable requests + hash
                                                        - UTC-day ledger: executed + pending
                                                        - single dispatch point
                                                             |
                                          ft_transfer (1 yocto) | then on_transfer_result (#[private])
                                                             v
                                                    NEP-141 token contract
                                                             |
                                                         recipient

 planned: web approval page, API/indexer, Telegram notifier, MCP tool, 1Click adapter (P1)
```

## Vault contract (`contracts/spendpact-vault`) [built]

**State:** owner, network label, agents (max 8), paused flag, policy (tokens, recipient allowlist, limits), `policy_version`, open-approval counter, requests (`IterableMap<String, PaymentRequest>`), ledgers keyed by `(token, utc_day)`, stored-request counts per day.

**Request lifecycle**

```text
request_direct_payment (agent)
  |-- policy check fails ----------------------------> BLOCKED (returned + event, not stored)
  |-- amount <= auto_limit --> reserve + ft_transfer --> TRANSFER_PENDING
  '-- amount >  auto_limit ---------------------------> AWAITING_APPROVAL
AWAITING_APPROVAL --approve_request(id, hash) by owner--> APPROVED
AWAITING_APPROVAL | APPROVED --reject_request by owner--> DENIED
AWAITING_APPROVAL | APPROVED --expire_request after TTL--> EXPIRED
APPROVED --execute_request (owner or agent), rechecks--> reserve + ft_transfer --> TRANSFER_PENDING
TRANSFER_PENDING --callback: transfer ok-----> SETTLED          (pending -> executed)
TRANSFER_PENDING --callback: transfer failed-> TRANSFER_FAILED  (pending released)
```

The spec's AUTO_AUTHORIZED, RESERVED and SOURCE_CONFIRMED states happen inside one receipt, so they are never observable and not stored (ADR-007).

**Checks for a new request, in order:** paused, request id format, duplicate id, amount > 0, reason (at most 256 bytes, no control characters), token in policy, recipient allowlisted, amount <= hard cap, amount <= today's available budget, open-approval cap (approval path only), stored-requests-per-day cap.

**Execution rechecks:** caller is the owner or the requesting agent, status is APPROVED, not paused, policy version unchanged, not expired, agent still allowed, budget available.

**Budget:** `available = daily_limit - (executed + pending)` for `(token, floor(block_timestamp / 1 day))`. Reservation happens in `dispatch`, the only place a payment transfer is created, before the promise is sent. The callback moves the amount from pending to executed on success, or releases it on failure. It does this only if the request is still TRANSFER_PENDING, so it runs at most once, and always on the day recorded at dispatch.

**Request hash:** sha256 over a versioned, borsh-compatible encoding of domain, network, vault id, request id, agent, route, token, amount, recipient, reason, expiry and policy version (`src/digest.rs`, mirrored in `packages/shared/src/digest.ts`).

**Events:** NEP-297 `EVENT_JSON` with standard `spendpact` for policy, pause, agent changes, blocked requests, status transitions and owner withdrawals. Indexers read events; contract state is the source of truth.

## Mock token (`contracts/mock-ft`) [built, test only]

A wrapper around `near-contract-standards` `FungibleToken`. It exists so tests use real NEP-141 semantics: storage registration, 1 yocto on transfer, and a failed transfer to an unregistered account.

## Shared TS package (`packages/shared`) [built]

Contract JSON types, reason codes with user-facing text, exact BigInt amount parsing, and the request digest. This is what the approval page will use to hash the terms it displays.

## Planned (not built)

| Component | Role | Authority |
|---|---|---|
| Web app (React/Vite) | dashboard, approval page, Security Lab view | none: the owner's wallet signs |
| API (Hono on Workers) | relay agent requests, index events, send notifications | none: on-chain state wins |
| Telegram bot | notify the owner, deep-link to the approval page | none: a button tap cannot approve |
| MCP server | `request_payment` and `get_payment_status` tools for the agent | the agent's restricted key only |
| 1Click adapter (P1) | quote and owner-approved cross-chain route | trusted off-chain quote, disclosed |
