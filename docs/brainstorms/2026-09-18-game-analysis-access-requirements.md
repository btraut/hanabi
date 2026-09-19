---
date: 2026-09-18
topic: game-analysis-access
---

# Game analysis access

## Problem

An operator must be able to describe a production Hanabi round by code, players, or date and have an agent retrieve its accepted moves and conversation for analysis. The permanent PostgreSQL archive stores moves and hand movements, while chat only exists in capped, expiring active-game snapshots. Production already exposes an authenticated archive API; a separate authentication bypass is unnecessary.

## Requirements

- R1. Preserve accepted gameplay moves and record human chat and public bot explanations independently, including author, time, and the number of preceding moves.
- R2. Include lobby chat in the ensuing round and post-game discussion in the completed round until reset. This is the default interpretation of “all chat.” A lobby that never starts has no archived round.
- R3. Keep chat beyond the active feed's event cap, resets, reconnects, and live-game expiry. Mark legacy coverage unavailable or partial; do not reconstruct missing messages as facts.
- R4. Let authenticated administrators download archived unfinished, reset, partial, and finished rounds. Preserve the existing finished-replay restriction for the review UI.
- R5. Supply a repository skill and deterministic helper that searches by code, player, and time, then downloads the selected round into ignored private local storage without exposing credentials.

## Success criteria

An agent can identify a round from an ordinary description, fetch it from production, and distinguish observed moves, recorded explanations, and unavailable history. Automated checks cover capture, restart/reset boundaries, bot explanations, authorization, and helper behavior. The existing production API provides a live end-to-end retrieval check before deployment of expanded capture.

## Scope and dependencies

Reuse admin authentication and PostgreSQL transcript storage. No gameplay changes, public archive, chat viewer, private model reasoning access, historical data invention, or new database service. Existing asynchronous persistence can lose the latest unflushed snapshot during an outage; this change does not add transactional move acknowledgments. Railway CLI authentication supplies the existing operator access. Production must use a strong admin password; credential rotation is a separate deployment operation.

## Implementation checkpoints

- ✅ Capture chat independently of the bounded live activity feed and preserve honest legacy coverage. Includes restart/reset validation and append-only database reconciliation.
- ✅ Add protected analysis export and verify production retrieval through the existing API. Retrieved a complete 31-move production round; its historical chat is unavailable.
- ✅ Add and validate the repository skill, helper, and recording documentation. The helper searches production and writes ignored downloads with owner-only permissions.
- ✅ Run focused behavior tests and repository quality checks before handoff. Full suite: 806 passed, one environment-gated PostgreSQL integration test skipped; typecheck, lint, and production builds pass. Nx checks use `NX_DAEMON=false` after a local daemon failure.

Deployment of the server changes and production admin-password configuration remain release work;
the production retrieval verification used the existing finished-round API.
