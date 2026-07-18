---
title: 'feat: Animate tile actions between hand and board'
type: feat
status: completed
date: 2026-07-18
origin: docs/brainstorms/2026-07-18-tile-action-transitions-requirements.md
---

# feat: Animate tile actions between hand and board

## Overview

Turn each authoritative play or discard refresh into a shared-element transition from the acted tile's current hand position to its rendered destination. The implementation must work for acting players, remote players, and spectators while leaving React DnD's hand-reordering path untouched.

## Implementation Approach

Use the browser's same-document View Transitions API at the game-data update boundary. A pure helper will recognize newly appended play/discard actions without assuming they are the final action in a refresh. Board tile instances will receive stable, UUID-derived `view-transition-name` values, allowing the browser to bridge the unmount/remount across hand and responsive destination components. Unsupported browsers and reduced-motion users will receive the authoritative state update without spatial animation. Root-page crossfading will be disabled so only named tiles move.

The dormant `HanabiAnimatableBuilder` and shared animatable interfaces will not be extended: they are unused, lack discriminants, skip the first new action, and cannot capture pre-update DOM state.

## Task Breakdown

### Task 1: Detect and coordinate action-bearing updates

- Goal: Start a transition only when an incoming authoritative state appends a play or discard action.
- Depends on: None
- Parallelizable: No
- Deliverables:
  - A pure selector for newly appended play/discard actions, including refreshes with trailing shot-clock or game-finished actions.
  - Focused unit tests for play, discard, non-action updates, initial hydration, reset/truncated history, and multi-action refreshes.
  - A game-controller update delegate that uses `startViewTransition` with synchronous React commit and safe immediate fallbacks.

### Task 2: Give hand and destination tiles stable transition identities

- Goal: Let the same logical tile bridge its source and destination render trees without changing drag transforms.
- Depends on: Task 1
- Parallelizable: No
- Deliverables:
  - A shared transition-name helper for tile UUIDs.
  - Stable names on hand tiles, desktop played/discard tiles, and compact played/discard tiles.
  - Transition CSS that disables root crossfade, uses an intentionally legible duration/easing, and suppresses motion for reduced-motion users.

### Task 3: Verify gameplay and drag coexistence

- Goal: Prove the transition explains actions without regressing interaction or builds.
- Depends on: Tasks 1 and 2
- Parallelizable: No
- Deliverables:
  - Focused unit test, typecheck, lint, and build/test gates.
  - Browser proof for successful play, explicit discard, failed play, remote observation, responsive destinations, and drag before/after an action.

## Acceptance Criteria

- [ ] Every observer sees a played/discarded tile move from the acting hand to the actual rendered destination.
- [ ] Successful plays target the played stack; explicit discards and failed plays target the discard area.
- [ ] The board does not crossfade as a whole and the moving tile is not visibly duplicated.
- [ ] Hand dragging and reordering behave the same outside authoritative action updates.
- [ ] Reduced-motion and unsupported-browser paths update immediately without animation.
- [ ] Focused tests, `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` pass, or unrelated blockers are reported without modifying their files.

## Sources

- Origin document: `docs/brainstorms/2026-07-18-tile-action-transitions-requirements.md`
- Relevant files: `apps/web/src/games/hanabi/client/HanabiGameController.tsx`, `apps/web/src/games/hanabi/client/HanabiPlayerTiles.tsx`, `apps/web/src/games/hanabi/client/HanabiPlayedTiles.tsx`, `apps/web/src/games/hanabi/client/HanabiPlayedTilesCollapsed.tsx`, `apps/web/src/games/hanabi/client/HanabiDiscardedTilesCollapsed.tsx`, `apps/web/src/styles/tailwind.css`
- Server state semantics: `apps/server/src/games/hanabi/HanabiGame.ts`
