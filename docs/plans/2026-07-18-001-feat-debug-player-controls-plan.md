---
title: 'feat: Add single-browser debug player controls'
type: feat
status: completed
date: 2026-07-18
---

# feat: Add single-browser debug player controls

## Overview

Add an explicitly invoked development mode that lets one browser create and control a fake Hanabi player. The feature must reuse the authoritative server game rules, remain unavailable in production, and make the full two-player loop testable from one browser.

---

## Problem Frame

Developers and agents currently need two isolated browser sessions to exercise normal multiplayer turns. That slows routine UI and gameplay testing. A development-only controller should fill the second seat without weakening the production message boundary or duplicating game logic.

---

## Requirements Trace

- R1. Option-D toggles the debug UI in Vite development builds; `?debug=1` opens it directly and survives host/join navigation.
- R2. A joined game host can add one visibly identified fake player during setup; other users and production servers cannot use debug controls.
- R3. The host can play, discard, and give color or number clues as the fake player when it is that player's turn.
- R4. Debug actions use the existing authoritative validation and mutations, return a dedicated debug acknowledgement to the controlling browser, broadcast normal game state, and persist through the existing save path.
- R5. Server tests and a live single-browser run prove creation, authorization, action behavior, and the visible UI; the live run ends with a screenshot.

---

## Scope Boundaries

- Support one fake player per host, not arbitrary bot armies or automated strategy.
- Do not expose debug controls in production or add an HTTP admin API.
- Do not bypass turn, hand, clue, or game-stage validation.
- Do not redesign the regular player controls or websocket protocol beyond the debug-specific messages.

---

## Context & Research

### Relevant Code and Patterns

- `apps/server/src/games/hanabi/HanabiGame.ts` owns player management and all authoritative turn validation.
- `packages/shared/src/games/hanabi/HanabiMessages.ts` defines the scoped websocket contract shared by server and client.
- `apps/web/src/games/hanabi/client/HanabiGameMessenger.ts` provides the existing send-and-await response pattern.
- `apps/web/src/games/hanabi/client/HanabiGameView.tsx` is the common mount point across setup, play, and finished stages.
- `apps/server/src/games/hanabi/HanabiGame.test.ts` already exercises the public game message boundary with a fake socket manager.

### Institutional Learnings

- No matching `docs/solutions/` entry exists. Repository guidance requires preserving gameplay logic, keeping websocket semantics intact, and proving the feature in a browser.

---

## Key Technical Decisions

- Gate twice: Vite hides the panel outside development mode and exposes it through Option-D or `?debug=1`, while the server requires an explicit `DEBUG_PLAYER_CONTROLS=true` flag in addition to development mode. The development launcher sets the flag; production startup rejects it.
- Restrict creation and control to the game creator. The deterministic `debug:<host id>` player ID makes creation idempotent and lets refresh, reset, and hydration rediscover the fake without extra state.
- Add one debug-player creation message and one runtime-validated act-as-player discriminated union limited to play, discard, and clue actions. Existing handlers report through an injectable response callback so they validate and mutate as the fake while the envelope always returns one dedicated acknowledgement to the real controller.
- Render a native collapsible panel outside the board layout: bottom-right with a bounded scroll area on desktop and edge-inset full width on narrow screens. Keep it above the board but below modal/tooltips, use semantic action labels and visible focus states, and announce pending/errors through an `aria-live` status.

---

## Implementation Units

- U1. ✅ **Add the server-authoritative debug player protocol**

**Goal:** Create and control a host-owned fake player without copying gameplay rules.

**Requirements:** R2, R3, R4

**Dependencies:** None

**Files:**

- Modify: `packages/shared/src/games/hanabi/HanabiMessages.ts`
- Modify: `apps/server/src/games/hanabi/HanabiGame.ts`
- Modify: `apps/server/src/games/hanabi/HanabiGameFactory.ts`
- Modify: `apps/server/src/main.ts`
- Modify: `apps/server/src/env.ts`
- Modify: `scripts/dev-runtime.mjs`
- Test: `apps/server/src/games/hanabi/HanabiGame.test.ts`

**Approach:**

- Add typed debug request/response messages and use one deterministic fake-player identity per host.
- Parse a dedicated false-by-default server flag, enable it in the local launcher, reject invalid production enablement, and inject the resulting decision through the game factory for deterministic tests.
- Extract the normal add-player mutation into a shared internal path.
- Runtime-validate the nested action envelope before dispatch. Keep the fake as the gameplay actor while capturing the existing handler response and returning it in the debug acknowledgement.

**Execution note:** Add failing message-boundary tests before implementing the server behavior.

**Test scenarios:**

- Happy path: the host creates one fake player in setup and receives its ID.
- Edge case: a second creation request returns the existing fake rather than consuming another seat.
- Error path: debug-disabled games and non-host callers cannot create or control a fake.
- Error path: malformed or unsupported nested actions receive a debug error response without mutating state or timing out.
- Integration: fake play, discard, and clue commands pass through normal validation, update game state, advance the turn, broadcast, and acknowledge the host.
- Regression: an ordinary authenticated user still cannot act as another player through regular messages.

**Verification:**

- The public message-boundary tests prove debug authorization and all supported actions while existing Hanabi tests stay green.

**Implementation note:** Added fail-closed runtime gating, creator-owned idempotent fake players, dedicated acknowledgements, and shared normal/debug action handlers with prototype-safe clue validation.

- U2. ✅ **Build the invoked debug panel**

**Goal:** Make the fake player's complete turn controllable from the existing game page.

**Requirements:** R1, R2, R3, R4

**Dependencies:** U1

**Files:**

- Create: `apps/web/src/games/hanabi/client/HanabiDebugPanel.tsx`
- Modify: `apps/web/src/games/hanabi/client/HanabiGameMessenger.ts`
- Modify: `apps/web/src/games/hanabi/client/HanabiGameView.tsx`
- Modify: `apps/web/src/games/hanabi/client/HanabiMainMenu.tsx`
- Modify: `apps/web/src/games/hanabi/client/HanabiWatchForm.tsx`

**Approach:**

- Preserve the query string through game navigation and mount the panel only when invoked through Option-D or `?debug=1` in development.
- In setup, offer fake-player creation. During play, show turn status, fake hand cards with play/discard controls, and only valid clue choices that select at least one tile under the server's rules, including rainbow tiles matching each legal standard color.
- Use the stable name `Debug Player` everywhere the fake appears: lobby avatar, board identity, action history, and panel heading.
- Render the panel only for the joined creator. During setup it shows Add Debug Player or the existing fake; during play it shows read-only waiting state on real turns and actionable controls on fake turns; after finish it shows a read-only status. Pending operations disable all actions, and rejections remain visible until the next command.
- Group clues by eligible non-debug recipient. Each recipient row contains immediate-action color and number buttons with explicit labels; when no clue can be given, replace the buttons with the reason.
- Serialize commands in the panel and surface backend errors without disturbing the regular board.

**Test scenarios:**

- Integration: Option-D toggles the panel during a game, while starting at `/?debug=1` preserves the direct-open flag through hosting.
- Happy path: the panel reflects the fake hand and successfully issues play, discard, color-clue, and number-clue commands on its turn.
- Edge case: commands are disabled when it is not the fake player's turn, when no clues remain, and while another command is pending.
- Edge case: unjoined viewers and non-creators see no panel, an existing fake is rediscovered after refresh/reset, and finished games show no actionable controls.
- Error path: a server rejection appears in the panel and leaves controls usable afterward.

**Verification:**

- One browser can join, add the fake, start, and complete both sides of the turn loop without opening another session.

**Implementation note:** Added the creator-only responsive panel, query-preserving entry flow, serialized play/discard/clue controls, and accessible status/error states.

- U3. ✅ **Prove and document the workflow**

**Goal:** Leave a repeatable invocation and visible proof that the feature works.

**Requirements:** R5

**Dependencies:** U1, U2

**Files:**

- Modify: `README.md`

**Approach:**

- Document the development-only Option-D shortcut, `?debug=1` direct-open fallback, and supported fake-player actions.
- Run focused tests, repository quality gates, and a live browser smoke test; capture the debug panel controlling the fake player.

**Test scenarios:**

- Integration: the documented URL and steps work against a fresh development runtime.

**Verification:**

- Tests, typecheck, lint, and formatting pass, and a screenshot shows the panel in a live two-player game.

**Implementation note:** Verified 51 tests, typecheck, lint with zero errors, formatting, production fail-closed behavior, and the live single-browser workflow with screenshot evidence.

---

## System-Wide Impact

- **Interaction graph:** browser panel -> scoped debug message -> host authorization -> existing game action handler -> normal broadcast/save.
- **Error propagation:** creation has a dedicated response; act-as commands return the underlying action response to the host.
- **State lifecycle risks:** fake identity must survive serialization and reset, while duplicate creation must not add extra seats.
- **API surface parity:** production clients receive the shared types but production servers reject every debug message.
- **Integration coverage:** server message-boundary tests plus the live browser run cover the cross-layer contract.
- **Unchanged invariants:** normal player messages, turn validation, game rules, and long-lived socket behavior remain authoritative.

---

## Risks & Dependencies

| Risk                                                            | Mitigation                                                                                |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| A hidden UI-only gate leaks control to production               | Enforce an injected server-side debug flag on every debug request.                        |
| Debug action acknowledgements go to the nonexistent fake socket | Capture the existing handler result and return a dedicated response to the host.          |
| Random turn order makes the panel look inert                    | Show explicit turn status and keep normal controls available for the real player's turns. |
| Full clue menus become noisy                                    | Show only clue values that match at least one tile in the selected recipient's hand.      |

---

## Documentation / Operational Notes

- This mode is local development tooling. It has no production rollout or migration.
- Invocation is explicit: press Option-D on the page or append `?debug=1` to the development URL.

---

## Sources & References

- Related code: `apps/server/src/games/hanabi/HanabiGame.ts`
- Related code: `apps/web/src/games/hanabi/client/HanabiGameView.tsx`
- Related tests: `apps/server/src/games/hanabi/HanabiGame.test.ts`
