---
title: 'feat: Give Hanabi bots mode-specific rules, clue knowledge, and card layouts'
type: feat
status: completed
date: 2026-09-04
---

# Give Hanabi bots mode-specific rules, clue knowledge, and card layouts

## Recommendation and scope

Give each bot a complete observable event history, explicit provable card knowledge, and semantic layouts for every player. Keep group conventions in editable, versioned coaching. Let the model interpret intent, missed clues, and responsibility; do not encode those interpretations as certain card identities.

Bots have exactly two decision opportunities: their own turn and immediately after receiving a clue. Both may include an optional arrangement when dragging is enabled. An off-turn clue decision cannot play, discard, or give a clue. If the recipient becomes the next player, combine the clue response with its normal turn request. The model chooses whether to set cards aside, leave them in place, return them to the queue, or move a likely discard to its left edge. There is no forced set-aside movement. Other off-turn model activity is outside scope. Humans retain normal off-turn movement.

The server-bot POC is the foundation. Production deployment and unrelated game-review work are outside this plan. Local implementation and verification are complete; production deployment remains outside this plan.

## Requirements

| ID  | Required outcome                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | Send only the active mode's rules and enabled options, with prose and structured data derived from the shared engine definitions.                |
| R2  | A bot may arrange its own cards without spending a turn, then perform exactly one legal gameplay action on its turn.                             |
| R3  | Receiving a clue permits an immediate optional model arrangement, including off-turn; it never grants an extra gameplay action.                  |
| R4  | Describe every player's upper-row order and lower-area placement, preserving the complete observable event sequence for new rounds.              |
| R5  | Track positive and negative clue evidence by stable card ID, derive literal possible identities, and give new draws fresh knowledge.             |
| R6  | Keep facts, conditional convention interpretations, and unknown information distinct. Derive metadata only from the bot's permitted observation. |
| R7  | Preserve movement permissions, turn rules, persistence, budgets, retries, and protection against stale or duplicate decisions.                   |
| R8  | Request a concise explanation of each accepted decision and log it only on the server.                                                           |

## Active rules and versioned coaching

Build one active-rules descriptor from `packages/shared/src/games/hanabi/HanabiGameData.ts`. Use it for both prompt rules and the observation. Shared definitions supply suits, clue predicates, firework sequences, copy counts, and scoring limits.

| Supported mode         | Included rules                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `5-color`              | Five ordinary suits, ascending builds, five color clues.                                                                                   |
| `6-color`              | Five ordinary suits plus purple, an ordinary suit with its own clue color.                                                                 |
| `rainbow`              | Five ordinary suits plus Rainbow, which matches every permitted color clue and has no separate color clue.                                 |
| `black-powder`         | Five ordinary suits plus Black, with descending builds, its copy distribution, number-only matching, completion reward, and score penalty. |
| `rainbow-black-powder` | Five ordinary suits plus both extensions and their applicable rules.                                                                       |

Do not describe unsupported combinations. Include universal mechanics once: one action per turn, positive and negative clue information, replacement draws, token limits, life loss, completion rewards, and final turns. Explain the exact critical-game-over option, including fatal failed plays when enabled. Include dragging and visible-notes settings.

Separate the fixed fair-play/decision contract, active rules, and Markdown coaching. Snapshot the effective prompt, mode/options, model, reasoning effort, coaching version, clue-arrangement opportunity setting, and communication contract at round start. The configured default remains GPT-6 Astra / High. Validate saved policy identity without recomposing a running round from new instructions.

The group coaching defines the upper row as a discard queue: absent better information, its leftmost card is the default discard. The lower area holds set-aside cards without proving identity or playability. A touched card is usually worth setting aside, but the bot chooses its arrangement. A single-card clue usually invites a play, with context and exceptions. These agreements do not remove otherwise legal actions.

## The observation

| Layer               | Content                                                                                                         | Source                                                |
| ------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Active rules        | Mode/options, suits, clue matches, build sequences, copy counts, and end conditions.                            | Shared engine definitions.                            |
| Current observation | Turn/resources, fireworks, discards, deck count, visible faces, stable card IDs, and semantic layouts.          | Server projection for that bot seat.                  |
| Literal knowledge   | Positive/negative clue evidence, source event IDs, possible identities, and public remaining-copy counts.       | Deterministic derivation from permitted observations. |
| Event history       | Initial observation and every accepted turn action and committed arrangement, with causal ordering and context. | Private server record projected for the seat.         |
| Coaching            | Conditional group agreements and interpretations.                                                               | Round policy.                                         |
| Decision context    | Own-turn or clue opportunity, triggering clue event IDs, legal gameplay actions, and permitted layout contract. | Server validation rules.                              |

For every current card, record positive and negative clue evidence and its source events. Apply the actual clue-matching predicate: in Rainbow mode, matching red does not establish a red identity. Knowledge follows card IDs through rearrangements. A replacement draw has its own arrival event and no inherited clue evidence.

`possibleIdentities` reflects literal clue constraints and publicly exhausted copies, separately from a teammate's visible actual face. `observerPossibleIdentities` appears only for the bot's own cards and may additionally subtract copies visible in other hands. That observer-specific reduction does not describe a teammate's beliefs. Exact probabilities and joint-hand solving are deferred.

A single 2 clue establishes rank 2 and excludes rank 2 for untouched cards present at that moment. If only red had reached 1, the group convention may suggest red 2. Preserve the clue-time board so the model can interpret that signal. Do not make red a deterministic fact or reinterpret the old clue using a later blue 1.

### Causal history and clue metadata

Give each accepted event a stable ID, monotonic sequence, and turn index. Turn actions advance the turn index; arrangements do not. Preserve initial hands/layouts and enough exact deltas to reconstruct permitted history. Record committed arrangements rather than pointer motion.

Each clue includes giver, recipient, clue value, recipient hand IDs, touched/untouched IDs, touched count, pre-clue layout, board/resources, and per-card knowledge changes. Distinguish first evidence, first positive clue, repeated clues, and genuinely new constraints. These describe observable events, not the giver's private intention.

Arrangement events contain owner/actor, before/after layouts, changed cards, and source clue links when applicable. Record a clue before a resulting arrangement and preserve subsequent turn order. Exact no-op arrangements produce no layout event. The accepted model decision may still receive one explanation log.

Provide actual turns, clue availability, and positional context for interpretation of missed clues and responsibility. Do not create hard exclusions from a player declining to clue. Never derive another player's complete historical legal-clue menu or exact beliefs using server-only hidden faces. Project the historical view before deriving metadata.

### Completeness and payload bounds

New rounds retain complete turn and committed-layout history. Track turn-history and layout-history completeness separately; an old save may contain all clues without earlier arrangements. Do not fabricate missing events or silently label them complete.

Remove the fixed 512-move assumption. Preserve all meaningful committed events and causal boundaries, while ignoring exact duplicate layouts. Send the full compact history. If request size exceeds the configured budget, pause the bot with a clear reason rather than truncating clues or blocking human movement. Measure representative full-round payload size before release. Summarization requires a separate design with provenance guarantees.

## Decision and movement contracts

A v2 decision contains:

```text
actionId: supplied legal ID on the bot's turn; null for an off-turn clue opportunity
arrangement: null, or a complete target layout of the current own hand
  orderedRow: card IDs from left to right
  lowerArea: card IDs with normalized x/y and relative stackOrder
explanation: concise, nonempty decision summary, at most 1000 characters
```

Every own card appears exactly once across the two layout collections. Reject duplicate, foreign, missing, stale, or invalid IDs, nonfinite/out-of-range positions, and invalid stack order. A null arrangement leaves the layout unchanged. The shared helper converts a semantic target to canonical board coordinates; the upper row stays densely packed left. Overlap and stacking remain available below.

Humans continue sending partial coordinate patches through `MoveTiles`. Validate ownership and bounds, merge with the current hand, and compact the resulting upper row. Do not require human patches to list the full hand. Enforce `allowDragging` server-side for humans and bots; when disabled, bot arrangements must be null and off-turn clue opportunities are not scheduled.

For a turn decision, validate the arrangement and gameplay action against one captured round/revision before mutating anything. Apply arrangement before action using stable IDs, then persist and publish. Do not call independent public handlers in a way that self-invalidates the request or leaves half a decision applied. Replacement draws join the right end with fresh knowledge.

For an off-turn clue decision, accept only an optional arrangement and explanation. It cannot change turn, clues, lives, final-turn counters, or cards in play. A bot may move a likely discard to the queue's left edge or choose no movement. Human movement remains permitted off-turn. Finished rounds accept no further bot arrangements.

### Opportunity scheduling and recovery

Queue a clue opportunity after an accepted clue to an eligible bot. Capture the settled post-clue observation before inference. When that bot also has the next turn, one request covers both opportunities. Do not create additional opportunities from ordinary plays, discards, human arrangements, or another bot's arrangement.

Clue opportunities use the same provider, concurrency limits, token reservations, deadline, retry controls, and persistence rules as turn requests. Correlate requests with their source clue event IDs. External state changes invalidate in-flight results; retain legitimate pending opportunities for a fresh observation. A bot's own accepted layout must not trigger another paid request. Reset, finish, shutdown, duplicate results, and restored games retain existing stale-result protections.

Expose the active opportunity in bot status so the avatar can signal an off-turn clue response as well as a turn decision. A paused clue opportunity remains retryable while a human is current. If that failed optional response would block a different bot's actual turn, discard the failed invitation with a sanitized warning and leave cards unchanged, then continue scheduling. Never skip a failed combined turn action. A fresh clue is a new opportunity and must not be discarded because an earlier invitation failed. Test coalescing, multiple bots, and consecutive clues without inference loops.

### Explanations and server logging

Ask for the chosen action or arrangement, its main supporting clue/convention, and relevant uncertainty. Request a short decision summary, not hidden chain-of-thought. Explanations are model claims and never become factual clue knowledge.

Emit one structured `console.log` entry after an accepted v2 decision, including decision/event ID, game and bot IDs, opportunity and triggering clue IDs, turn index, model/policy, resolved action, applied arrangement, and explanation. A valid decision to leave the layout unchanged may be logged once without inventing a layout event. Use structured serialization so line breaks and control characters cannot forge log entries.

Keep explanations on the server: the bot sees teammate cards hidden from those players. Do not put explanations into sockets, public snapshots, or the browser console. Never log credentials, full observations, raw provider responses, or private reasoning. Failed, rejected, stale, or duplicate results must not appear as accepted decisions. Legacy rounds retain action-only behavior without fabricated explanations.

## Implementation units and verification

### ✅ U1. Shared layout semantics

**Completed:** Shared projection/validation and authoritative queue compaction are implemented; layout and game integration tests pass.

**Requirements:** R2–R4, R7. **Dependencies:** none.

Extract projection, full target validation, and canonical placement in shared drag/layout helpers. Preserve human partial patches, lower-area placement/stacking, upper insertion/compaction, and right-end draws. Add an internal server arrangement path and enforce dragging permissions. No automatic set-aside helper is needed.

**Verify:** Upper-to-lower movement compacts only the queue; lower overlaps survive. Valid partial human updates work off-turn. Disabled dragging and invalid complete bot layouts leave all state unchanged. New draws join the right end; an empty deck creates no phantom card.

### ✅ U2. Complete observable history

**Completed:** V2 records every committed event. A 20,000-event save exceeding 16 MB roundtrips without losing history; a complete game replays and restores identically.

**Requirements:** R3–R6, R7. **Dependencies:** U1.

Version the event record with arrangement events, sequence/turn indices, clue sources, pre-event context, and separate completeness markers. Preserve legacy evidence. Remove arbitrary move-count rejection without accepting malformed records.

**Verify:** Initial hands, clues, turn actions, and arrangements reconstruct the allowed state in order. Clue-caused arrangements reference the accepted clue. No-op commits produce no event. Save/reload preserves ordering, and older saves retain honest completeness markers. More than 512 valid events remains supported.

### ✅ U3. Literal knowledge and semantic observations

**Completed:** Source-linked positive/negative facts, candidate identities, clue novelty, every-player layouts, and observer-specific deductions pass variant and hidden-information invariance tests.

**Requirements:** R4–R6. **Dependencies:** U2.

Derive source-linked clue constraints, possible identities, novelty metadata, and explicit layouts from the seat-filtered history. Keep literal owner knowledge, visible faces, observer-specific deductions, and convention interpretations distinct.

**Verify:** Positive and negative rank clues constrain only cards present then; draws reset knowledge, and movement preserves it. Rainbow intersections and Black number-only behavior match the engine. Repeated clues report novelty accurately. The single-2 example retains literal suit possibilities and the clue-time board. Indistinguishable hidden-card/deck worlds yield identical serialized observations and metadata.

### ✅ U4. Active rules and coaching snapshots

**Completed:** All supported modes/options, serialized policy identity, legacy v1 behavior, and GPT-6 Astra / High configuration are covered by passing tests.

**Requirements:** R1, R3, R6, R8. **Dependencies:** U1–U3.

Compose per-round instructions from the shared rules descriptor and editable coaching. Snapshot mode/options, coaching/version, model/effort, clue-arrangement eligibility, and communication version. Preserve the original v1 policy hash and provider/observation dispatch.

**Verify:** Every supported mode includes its applicable clauses and excludes unrelated ones. Critical-game-over, dragging, and notes options agree with the engine. Prompts and structured rules share a descriptor. Policy hashes change with configuration while saved round snapshots survive restart and JSON storage property reordering. Group coaching makes set-aside optional and single-card play signals conditional.

### ✅ U5. Combined turns and clue opportunities

**Completed:** 22 integration scenarios cover optional clue responses, combined turns, failed-response recovery, stale responses, and private explanation logs. Real GPT-6 Astra / High returned an accepted off-turn arrangement and a later legal turn action in two requests.

**Requirements:** R2, R3, R6–R8. **Dependencies:** U1–U4.

Add strict v2 schema/parser and domain validation, staged arrangement-plus-action commits, clue-only requests, pending-opportunity persistence, own-turn coalescing, and correlated server-only explanations. Preserve v1 action-only requests and saved-round behavior.

**Verify:** Arrange-plus-play/discard/clue consumes exactly one turn and stable IDs keep actions attached to the intended card. Off-turn clue responses can move or decline movement without any gameplay action. Invalid decisions never partially mutate state. Human changes, reset, finish, shutdown, restore, and duplicates cannot apply stale decisions. Requests do not loop after accepted arrangements. A failed optional response cannot block another bot's turn, and a fresh clue remains eligible after an older failure. Accepted explanations log once; stale/rejected results do not. Empty/oversized explanations fail, and no public payload contains them.

### ✅ U6. Compatibility, browser proof, and documentation

**Completed:** IAB verified the off-turn glow, neutral Considering clue badge, correct human turn ownership, and dense card rows at 390×844 and 1440×1000. The real-model server harness verified arrangement/action application and explanations; replay/hydration tests verified persistence. Documentation describes the current contract.

**Requirements:** R1–R8. **Dependencies:** U1–U5.

Document mode-specific instructions, knowledge layers, optional arrangements, the two opportunity windows, server logging, and legacy behavior. Use deterministic providers for integrated gameplay and browser demonstrations before a bounded real-model smoke test.

**Verify:** Restore a v1 round without changing its policy or granting clue opportunities. Restore v2 pending opportunities and accepted layouts. In IAB desktop and phone layouts, show an off-turn bot arranging after a clue and a turn request arranging then acting. Reconnect preserves positions and event order. Verify the matching server explanation and absence from client snapshots. Run domain/provider/coordinator/integration tests, quality/build checks, and the real-model smoke test. Measure a complete-round request size and report unrelated existing failures without changing their files.

## Verification results (2026-09-04)

The complete suite passes 532 tests; one environment-gated test remains skipped. Repository lint, production server/web builds, server source typecheck, shared/web typecheck, scoped formatting, and diff checks pass. Repository-wide typecheck still reports three pre-existing test errors: `apps/server/src/admin.test.ts:56` (string enum), and `apps/server/src/games/hanabi/HanabiGame.test.ts:861` and `:865` (nullable transcript deck). Those unrelated files are unchanged.

A seven-suit, five-player deterministic round completed 103 gameplay turns with 103 arrangements and 50 provider requests. Peak complete observation plus default instructions was 458,094 UTF-8 bytes. The v2 request limit is 512,000 bytes; excessive history pauses inference while the full record remains saved. The real-model smoke test used two requests, one clue-only and one normal turn, and confirmed server-only accepted-decision explanations.

## Delivery boundaries and deferred work

Enable v2 only when its policy, observation, history, schema, scheduling, and application semantics agree. Main risks are hidden-information leakage, stale or partial decisions, ambiguous event timing, and prompt growth. Projection-first derivation, versioned snapshots, staged validation, causal records, and bounded requests address these risks; persistence does not guarantee crash-proof exactly-once billing.

Formal missed-clue/responsibility inference, exact probabilities, joint-hand solving, general off-turn thinking, editable coaching UI, persistent hypothesis journals, and strategy benchmarks remain separate work. The factual record supports those additions without turning interpretations into facts.

## References

Foundation: `docs/plans/2026-09-04-001-feat-server-hanabi-bots-plan.md`.

Shared rules and layouts: `packages/shared/src/games/hanabi/HanabiGameData.ts` and `HanabiDragDropUtils.ts`.

Server authority and bot integration: `apps/server/src/games/hanabi/HanabiGame.ts` and `bots/`.

Client movement and status: `apps/web/src/games/hanabi/client/HanabiMoveTileController.tsx`, `HanabiPlayerTiles.tsx`, and `HanabiPlayerWorkspace.tsx`.
