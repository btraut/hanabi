---
title: Game Transcript Persistence
type: feat
status: completed
date: 2026-09-01
---

# Game Transcript Persistence

## Overview

Add a deliberately small Postgres telemetry path that records each started Hanabi round as a versioned JSON transcript. Active-game recovery remains in the existing Redis/file `GameStore`; Postgres stores durable replay inputs and outcomes without adding accounts or changing gameplay.

---

## Requirements Trace

- R1. Provision PostgreSQL in Railway and provide an equivalent local development service.
- R2. Use Drizzle as the schema and query layer with versioned migrations.
- R3. Define a stable transcript notation containing player names, exact deck order, randomized turn order, accepted player moves, and the final result.
- R4. Create one transcript when a round starts and record successful play, discard, and clue moves in server order.
- R5. Keep persistence independent from active-game storage and prevent telemetry outages from interrupting gameplay.
- R6. Drain queued transcript writes during graceful shutdown and make write failures visible in logs and shutdown results.

---

## Scope Boundaries

- No user accounts, player profiles, replay UI, transcript API, analytics dashboard, or normalized event warehouse.
- Do not persist chat messages or drag/position updates; neither is required to replay rules, and chat would create needless permanent PII.
- Do not replace the existing Redis/file `GameStore`; it owns restorable active state and intentionally prunes stale games.
- Record only accepted game moves. Invalid requests must not appear in transcripts.

---

## Context & Research

### Relevant Code and Patterns

- `apps/server/src/main.ts` constructs infrastructure and is the correct place to open database connections.
- `apps/server/src/runtime.ts` owns startup/readiness and graceful shutdown.
- `apps/server/src/games/hanabi/HanabiGame.ts` has the authoritative start, play, discard, clue, reset, and finish transitions.
- `packages/shared/src/games/hanabi/HanabiGameData.ts` owns deck generation, player order, actions, scoring, and round seeds.
- `apps/server/src/env.ts` validates production configuration and supports app-root and repo-root `.env` files.
- `railway.toml` already controls production build, pre-start behavior, health checks, and shutdown timing.

### Institutional Learnings

- Active-game saves are coalesced and drained on shutdown; transcript writes need the same ordering and drain guarantees without sharing deletion semantics.
- A reset keeps the game ID/code but generates a new seed, so the seed is the natural per-round transcript key.
- The client-facing action list mixes chat/system events, is capped, and is cleared on reset; durable moves must be recorded directly at accepted mutation points.

### External References

- Drizzle PostgreSQL connections and drivers: https://orm.drizzle.team/docs/get-started-postgresql
- Drizzle code-first migrations: https://orm.drizzle.team/docs/migrations
- Railway PostgreSQL service: https://docs.railway.com/databases/postgresql
- Railway pre-deploy migrations: https://docs.railway.com/deployments/pre-deploy-command
- Railway service-variable references: https://docs.railway.com/variables/reference

---

## Key Technical Decisions

- Use Drizzle with the `postgres` driver. The server needs one tiny connection pool and no framework-level data layer.
- Store one row per round in `game_transcripts`, keyed by the round seed. Keep timestamps and game identifiers as columns and the replay document as JSONB.
- Transcript notation version 1 stores game/rules settings, ordered `{id, name}` players, deal order, randomized turn order, exact first-consumed-first tile definitions, sequential moves, lifecycle status, integrity status, and an optional result.
- Preserve the exact deck by recording cards in actual consumption order: each player's full initial hand in deal order, followed by the remaining tile-ID array reversed because gameplay draws with `pop()`.
- Inject a narrow recorder through `main.ts` → `runtime.ts` → `HanabiGameFactory.ts` → `HanabiGame.ts`.
- Keep the in-progress transcript beside `HanabiGameData` in the server-only serialized game envelope. Each accepted turn updates that transcript synchronously before the active-state save, so restoration retains the move sequence even if Postgres was briefly unavailable.
- Recorder methods accept immutable complete snapshots rather than deltas. A bounded, per-round coalescing queue keeps only the newest pending snapshot for each round, preventing a database outage from growing memory with one object per move.
- Use short connection/query timeouts, bounded retries, and a close deadline below the server's 10-second forced-shutdown limit. Errors are sanitized, logged with game/round context, and retained for shutdown reporting but never reject a socket action.
- Upsert only monotonic revisions. A restored legacy game without a server-side transcript creates an explicitly partial transcript from the retained authoritative state; conflicting or stale histories are marked non-complete instead of being presented as replayable.
- Apply checked-in Drizzle migrations locally through a script and in Railway through a pre-deploy command.

---

## Open Questions

### Resolved During Planning

- Prisma or Drizzle? Drizzle; it adds less machinery and keeps the SQL/schema visible.
- One table or normalized moves? One JSONB transcript row; Hanabi rounds are small, and replay reads want the complete document.
- What identifies repeated rounds in one lobby? The existing per-reset seed, not the stable game ID.
- What counts as a move? Successful play, discard, and clue actions only; shot-clock/finish actions become post-move state/result fields because every terminal transition currently occurs inside an accepted turn.
- What happens on reset? Finalize the current round as `reset` before creating the next seed; reset itself is a lifecycle outcome, not a player move.
- What if Postgres misses a write? The next complete snapshot repairs the row. If active-state restoration and the durable row diverge, retain the durable history and mark integrity as conflicted rather than silently rewriting it.

### Deferred to Implementation

- Exact helper names and Drizzle query composition may adjust to current type inference and generated migration output.
- Railway's current service name must be discovered before creating the `${{Postgres.DATABASE_URL}}` reference.

---

## Implementation Units

- U1. ✅ **Transcript contract and recording seam**

**Goal:** Define replay notation and invoke a narrow recorder exactly once for round start and each accepted player move.

**Requirements:** R3, R4, R5

**Dependencies:** None

**Files:**

- Create: `apps/server/src/games/hanabi/GameTranscript.ts`
- Create: `apps/server/src/games/hanabi/GameTranscriptRecorder.ts`
- Create: `docs/specs/game-transcript-v1.md`
- Modify: `apps/server/src/games/hanabi/HanabiGame.ts`
- Modify: `apps/server/src/games/hanabi/HanabiGameFactory.ts`
- Modify: `apps/server/src/runtime.ts`
- Test: `apps/server/src/games/hanabi/GameTranscript.test.ts`
- Test: `apps/server/src/games/hanabi/HanabiGame.test.ts`
- Test: `apps/server/src/runtime.test.ts`

**Approach:**

- Define the complete v1 contract and representative JSON notation in `docs/specs/game-transcript-v1.md`: version; round/game metadata; rules; ordered players; deal/turn order; exact deck; discriminated play/discard/clue moves with action ID, index, timestamp, actor, payload, selected clue tiles, next player, and post-move resources; lifecycle/integrity; optional result.
- Build a start snapshot from authoritative server state after dealing and turn-order selection, then retain it in the server-only serialized game envelope.
- Record a move only after its handler has fully mutated state and completed the turn; this same post-turn snapshot captures every completed-game result.
- Finalize an in-progress round as `reset` before replacing its seed.
- Reuse the persisted seed and transcript envelope so a restored in-progress game continues the same round; create an integrity-marked partial snapshot only for legacy active games without the envelope.

**Patterns to follow:**

- Existing dependency injection in `apps/server/src/runtime.ts` and `apps/server/src/games/hanabi/HanabiGameFactory.ts`.
- Existing typed action model and score helpers in `packages/shared/src/games/hanabi/HanabiGameData.ts`.

**Test scenarios:**

- Happy path: starting a round captures player names/deal order, separate randomized turn order, rule settings, initial hands, and every distinct tile exactly once in first-consumed-first order.
- Happy path: play, discard, and clue each append one sequential move with actor, timestamp, action-specific data, next player, and post-move resources.
- Edge case: reset finalizes the current round as `reset`; restart under the same game ID creates a distinct transcript keyed by the new seed.
- Error path: rejected out-of-turn or invalid actions append nothing.
- Integration: a hydrated in-progress game records its next accepted move against the original seed; a legacy hydrated game is explicitly partial.

**Verification:**

- Recorder spies observe one start and exactly one event per successful turn with no gameplay response changes.

**Implementation note:** Transcript v1, round lifecycle handling, recorder injection, hydration support, and accepted-move coverage are implemented and tested.

---

- U2. ✅ **Drizzle/Postgres storage and migrations**

**Goal:** Persist versioned transcripts in one Postgres table and serialize writes safely.

**Requirements:** R2, R4, R5, R6

**Dependencies:** U1

**Files:**

- Create: `apps/server/src/db/schema.ts`
- Create: `apps/server/src/db/database.ts`
- Create: `apps/server/src/db/migrate.ts`
- Create: `apps/server/src/games/hanabi/PostgresGameTranscriptRecorder.ts`
- Create: `apps/server/src/games/hanabi/PostgresGameTranscriptRecorder.test.ts`
- Create: `drizzle.config.ts`
- Create: `drizzle/`
- Modify: `apps/server/package.json`
- Modify: `scripts/build-server.mjs`
- Modify: `pnpm-lock.yaml`

**Approach:**

- Upsert the latest complete v1 snapshot and monotonic revision; do not mutate durable rows with stale or divergent histories.
- Coalesce pending work by round, cap total pending rounds, bound retries and query duration, and retain failures for `close()` after sanitized logging.
- Build a production migration entrypoint beside the server bundle.

**Test scenarios:**

- Happy path: start and subsequent full snapshots produce an ordered transcript and update finish metadata.
- Edge case: an equal duplicate revision is idempotent; a stale revision is ignored; a divergent revision marks integrity as conflicted.
- Edge case: a move after process restoration continues from the stored transcript revision; a failed initial insert is repaired by the next full snapshot.
- Error path: failed writes are retried within bounds, later snapshots still run, pending memory remains capped, and shutdown reports retained failures before its deadline.
- Integration: generated migration applies to a real local Postgres instance and the recorder round-trips a transcript row.

**Verification:**

- Drizzle migration creates one indexed table, and a local database query returns the expected v1 document after a played turn.

**Implementation note:** Two generated migrations create the indexed JSONB table and support nullable start timestamps for legacy partial transcripts. Queue, reconciliation, retry, overflow, and real-Postgres round-trip tests pass.

---

- U3. ✅ **Runtime configuration and local Postgres**

**Goal:** Make transcript persistence explicit in production and easy to run locally.

**Requirements:** R1, R5, R6

**Dependencies:** U2

**Files:**

- Create: `compose.yaml`
- Modify: `apps/server/src/env.ts`
- Modify: `apps/server/src/env.test.ts`
- Modify: `apps/server/src/main.ts`
- Modify: `.env.example`
- Modify: `apps/server/.env.example`
- Modify: `README.md`
- Modify: `docs/deployment.md`
- Modify: `railway.toml`

**Approach:**

- Require a valid PostgreSQL URL in production; allow the recorder to be disabled in development/test when it is absent.
- Start local Postgres with one Compose service and a health check; document migration/start commands.
- Close the recorder after socket/game shutdown has stopped new writes.

**Test scenarios:**

- Happy path: production accepts a valid `postgresql://` URL and development may omit it.
- Error path: production rejects missing, malformed, or non-Postgres `DATABASE_URL`.
- Integration: runtime shutdown drains and closes the injected recorder after stopping request/game components.

**Verification:**

- The local migration and recorder round-trip succeed against PostgreSQL, and the production server bundle includes the runtime and migration entrypoints.

**Implementation note:** Compose, environment validation, main/runtime wiring, build output, shutdown ordering, and local migration documentation are implemented. The migration and recorder were verified against the existing local PostgreSQL server because Docker Desktop was unavailable during implementation.

---

- U4. ✅ **Railway provisioning and production handoff**

**Goal:** Add Railway Postgres, reference its private URL from the Hanabi service, and prove connectivity/deployment readiness without releasing uncommitted application code.

**Requirements:** R1, R2, R6

**Dependencies:** U2, U3

**Files:**

- Modify: Railway project services and Hanabi service variables

**Approach:**

- Provision managed Postgres in the existing project.
- Set the app's `DATABASE_URL` to the Postgres service reference rather than copying credentials.
- Use the checked-in pre-deploy migration command so the normal application release creates or advances the schema before startup.

**Test scenarios:**

- Integration: the Postgres service reports healthy and the app resolves its reference variable.
- Error path: migration failure blocks deployment before the new server starts.

**Verification:**

- Railway shows a healthy Postgres service with durable storage, and the application reference resolves to `postgres.railway.internal`. The checked-in pre-deploy migration and application activation will run with the next normal release; no production app deployment was performed as part of this uncommitted implementation task.

---

## System-Wide Impact

- **Interaction graph:** Socket message → authoritative game mutation → server-side transcript update → active-state save plus coalesced Drizzle snapshot. Existing Redis/file storage retains the same pruning role.
- **Error propagation:** Database errors are logged and retained by the recorder; socket responses and game state changes still succeed. Shutdown returns accumulated failures.
- **State lifecycle risks:** Reset finalizes the old seed and creates a new row; pruning deletes only active-state storage; restored games retain the transcript envelope; legacy/restoration conflicts are integrity-marked instead of silently forked.
- **API surface parity:** Debug-player actions already funnel through the same play/discard/clue handlers and therefore produce identical transcript events.
- **Integration coverage:** Real Postgres migration/round-trip and runtime shutdown drain are required beyond mocked recorder tests.
- **Unchanged invariants:** Gameplay rules, client messages, recipient concealment, active-game recovery, and single-replica Socket.IO behavior remain unchanged.

---

## Risks & Dependencies

| Risk                                             | Mitigation                                                                                                             |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Telemetry latency blocks turns                   | Capture synchronously, coalesce bounded full snapshots, and never await the database in message handlers.              |
| Database outage grows memory or stalls shutdown  | Cap pending rounds, bound retries/query time, and stop recorder close before the server's forced-shutdown deadline.    |
| Writes reorder, disappear, or fork after a crash | Persist the transcript with active state, upsert complete monotonic snapshots, and integrity-mark divergent histories. |
| Reset overwrites an earlier round                | Key rows by round seed, not game ID.                                                                                   |
| Replay deck order is reversed or mis-dealt       | Record each full initial hand in actual deal order, then the remaining stack reversed to account for `pop()`.          |
| Production starts before schema exists           | Run checked-in migrations as Railway pre-deploy work.                                                                  |
| Permanent chat content creates privacy baggage   | Exclude chat entirely from transcript v1.                                                                              |

---

## Documentation / Operational Notes

- Document local Compose startup, migration, and teardown in `README.md`.
- Document Railway Postgres reference variables and pre-deploy migration behavior in `docs/deployment.md`.
- Treat player-entered names as private telemetry: keep Postgres private, never log transcript payloads/names, and document manual row deletion. Automatic retention is intentionally out of scope for v1 so replay history is not silently discarded.
- Keep credentials in environment variables only; no public database endpoint is required for the application.
