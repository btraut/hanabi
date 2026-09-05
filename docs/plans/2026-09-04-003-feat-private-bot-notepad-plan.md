---
title: Private Hanabi bot notepad
type: feat
status: completed
date: 2026-09-04
---

# Private Hanabi bot notepad

Each bot keeps an append-only journal for one round. Every accepted turn or after-clue decision automatically records the exact short explanation sent to the server console. The response also permits a nullable free-form Markdown note, up to 8,000 characters. Notes can contain hypotheses, conventions, future intentions, corrections, or any other text the bot finds useful.

Entries have a shared decision/log ID, opportunity kind, source clue IDs, and checkpoints immediately before and after the accepted decision. Each checkpoint identifies the event sequence and gameplay turn; this distinguishes an off-turn no-op from a layout change or gameplay action. The server supplies the receiving bot's entire journal on every subsequent invocation. Notes are private, revisable beliefs rather than guaranteed game facts.

New round policies enable a versioned notepad capability. Existing saved policies retain their original request/response contracts. Journals reset with the round and survive ordinary save/reload. Rejected, stale, failed, or duplicate responses never append notes. No journal enters public observations, sockets, game activity, or transcripts. The complete journal counts toward inference size and token budgets; oversized requests pause without silently dropping entries.

## Implementation and verification

- [x] ✅ Define and validate private entries and their historical checkpoints, including hydrated ownership and causal links.
- [x] ✅ Extend the versioned prompt and structured response with optional free-form notes, preserving old contracts.
- [x] ✅ Include only the receiving bot's complete journal in requests and budget accounting; atomically record accepted explanations and notes.
- [x] ✅ Verify turn/clue/no-op writes, later reads, seat isolation, logging correlation, reset/restore, invalid/stale rejection, and unchanged public payloads.
- [x] ✅ Update coaching documentation and run focused tests, lint, typecheck, builds, and a bounded real-model smoke test.

## Verification results

All 572 tests pass, with one environment-gated test skipped. Repository lint, production builds, server source typecheck, shared/web typecheck, scoped formatting, and diff checks pass. Repository-wide typecheck retains three unrelated existing failures: `apps/server/src/admin.test.ts:56` and `apps/server/src/games/hanabi/HanabiGame.test.ts:861,865`.

Thirteen new game integration tests verify accepted writes, automatic explanations, later reads, event checkpoints, per-bot isolation, persistence, reset, stale/invalid rejection, private public-payload boundaries, and log-ID correlation. Pure/hydration tests also preserve a notebook exceeding 16 MB and reject notebooks attributed to the wrong player or historical action.

A two-request GPT-6 Astra / High smoke test received zero prior entries on the clue opportunity and one prior entry on the following turn. Both responses included extra notes; both explanations and notes were retained with exact before/after event checkpoints. A complete seven-suit round with fifty decision entries uses 475,813 bytes including history, default instructions, and its private notepad, below the 512,000-byte request limit.
