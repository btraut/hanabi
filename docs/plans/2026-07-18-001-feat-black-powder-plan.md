---
title: Black Powder Game Mode
type: feat
status: completed
date: 2026-07-18
origin: docs/brainstorms/2026-07-18-black-powder-requirements.md
---

# Black Powder Game Mode

## Overview

Add the official Black Powder expansion alone and combined with Decoy Rainbow by extending the shared deck model, server-authoritative gameplay, score calculation, and existing board UI.

---

## Requirements Trace

- R1-R2. Selectable rule set with the official 60-tile composition.
- R3-R5. Descending black stack, colorless clue behavior, rank clues, and completion reward.
- R6. Six-stack completion with official penalty scoring capped at 25.
- R7-R8. Legible presentation without changing existing modes or serialization.
- R9. Combined Decoy Rainbow + Black Powder play with seven fireworks.

**Origin flows:** F1 (start a Black Powder game), F2 (play and clue black tiles)
**Origin acceptance examples:** AE1-AE5

---

## Scope Boundaries

- Black Powder may run alone or with the existing Decoy Rainbow expansion; other expansion combinations remain out of scope.
- No unrelated gameplay or layout redesign is included.
- Existing persisted games require no migration because the rule-set and color additions are backward-compatible string union members.

---

## Context & Research

### Relevant Code and Patterns

- `packages/shared/src/games/hanabi/HanabiGameData.ts` owns rule-set types, tile data, deck generation, and shared visual class maps.
- `apps/server/src/games/hanabi/HanabiGame.ts` validates settings and clues and resolves play, completion, clue rewards, and endgame state.
- `apps/web/src/games/hanabi/client/HanabiPlayedTiles.tsx` and collapsed board components derive suit presentation from the active rule set.
- `apps/web/src/games/hanabi/client/HanabiTileActionsTooltip.tsx` exposes tile-specific clue affordances.

### External References

- R&R Games Black Powder rules: https://rnrgames.com/Content/RRGames/images/productrules/Hanabi_BlackPowderExpansion_rules.pdf
- R&R Games base rules: https://rnrgames.com/Content/RRGames/images/productrules/hanabiDeluxeII_rules.pdf
- Cocktail Games expansion announcement: https://www.cocktailgames.com/hanabi-grands-feux-est-sorti/

---

## Key Technical Decisions

- Centralize rule-set suit lists and score/completion helpers in the shared package so server and web cannot drift.
- Treat black as a tile color for rendering and stack identity but never as a clueable color.
- Preserve the existing wire shape; the new rule-set and color values travel through current messages unchanged.
- Render black tiles with a clean ash gradient and inset bevel inside the existing tile component, and reverse only the black stack's visual order.

---

## Implementation Units

- ✅ U1. **Shared mode model and score rules** — Added the official deck composition, shared firework ordering, clue-color separation, completion helpers, and penalty scoring with unit coverage.

**Goal:** Represent the rule set, generate the official deck, expose shared suit/completion/score behavior, and prove it with unit tests.

**Requirements:** R1, R2, R5, R6, R8

**Dependencies:** None

**Files:**

- Modify: `packages/shared/src/games/hanabi/HanabiGameData.ts`
- Test: `packages/shared/src/games/hanabi/HanabiGameData.test.ts`

**Test scenarios:**

- Happy path: Black Powder produces 60 deterministic tiles with reversed black multiplicities.
- Edge case: Official score subtracts each missing black tile while existing modes keep their current score and ceiling.
- Edge case: Firework completion identifies ordinary 5 and black 1 correctly.

**Verification:** Focused shared tests pass.

- ✅ U2. **Server-authoritative Black Powder gameplay** — Enforced descending black plays, number-only black clues, black-1 rewards, and 30-position completion through public message-boundary tests.

**Goal:** Accept the mode and enforce descending play, clue restrictions, completion rewards, and six-stack victory.

**Requirements:** R1, R3, R4, R5, R6, R8

**Dependencies:** U1

**Files:**

- Modify: `apps/server/src/games/hanabi/HanabiGame.ts`
- Test: `apps/server/src/games/hanabi/HanabiGame.test.ts`

**Test scenarios:**

- Integration: Selecting and starting Black Powder deals normal hands from a 60-tile deck.
- Happy path: Black 5 followed by black 4 succeeds; black 1 completes the stack and restores a clue.
- Error path: Black 4 on an empty stack loses a life; a black color clue is rejected.
- Integration: A rank clue includes matching black and ordinary tiles while an ordinary color clue excludes black.
- Edge case: Victory requires all 30 stack positions even though the score ceiling is 25.

**Verification:** Public message-boundary tests prove the rules without reaching into private methods.

- ✅ U3. **Black Powder lobby and board presentation** — Added the lobby option, reversed black stack, compact score, black discard handling, number-only action UI, and clean ash tile styling.

**Goal:** Expose the mode, render the reversed stack and special score, remove the illegal color-clue action, and make black tiles unmistakable.

**Requirements:** R1, R4, R6, R7, R8

**Dependencies:** U1

**Files:**

- Modify: `apps/web/src/games/hanabi/client/HanabiChooseRuleSetForm.tsx`
- Modify: `apps/web/src/games/hanabi/client/HanabiPlayedTiles.tsx`
- Modify: `apps/web/src/games/hanabi/client/HanabiPlayedTilesCollapsed.tsx`
- Modify: `apps/web/src/games/hanabi/client/HanabiDiscardedTilesCollapsed.tsx`
- Modify: `apps/web/src/games/hanabi/client/HanabiTileActionsTooltip.tsx`
- Modify: `apps/web/src/games/hanabi/client/HanabiTileView.tsx`
- Modify: `apps/web/src/games/hanabi/client/actions/HanabiTileActionBody.tsx`
- Modify: `apps/web/src/styles/tailwind.css`

**Test scenarios:**

- Browser: The lobby lists Black Powder and the board shows a sixth stack ordered 5 through 1.
- Browser: Visible black tiles remain distinct from hidden tiles at regular and small sizes.
- Browser: A black tile offers only its number clue and the compact score uses the 25-point penalty formula.

**Verification:** Web typecheck/build pass and a browser screenshot confirms the rendered states.

- ✅ U4. **Cross-project quality gate** — Passed the complete test, typecheck, lint, build, format, diff, browser, and code-review gates; the accepted version-skew deployment constraint is documented separately.

**Goal:** Prove the complete feature and guard existing modes.

**Requirements:** R1-R8

**Dependencies:** U1, U2, U3

**Files:**

- Test: existing project suites and build configuration only

**Test scenarios:**

- Regression: Existing shared and server suites remain green.
- Static: Root lint, typecheck, format check, and build pass without unrelated rewrites.

**Verification:** All scoped and repository quality checks pass, or unrelated blockers are reported with exact commands and files.

- ✅ U5. **Combined Decoy Rainbow + Black Powder mode** — Added the seven-suit, 70-tile combination with rainbow color-decoy behavior, colorless black tiles, 35-position completion, and a 30-point ceiling.

---

## System-Wide Impact

- **Interaction graph:** Lobby setting -> shared rule-set value -> server deck/rules -> serialized game state -> board and tile actions.
- **Error propagation:** Invalid settings and clues continue through existing response-message errors.
- **State lifecycle risks:** No migration or new persistence surface; old serialized values remain valid.
- **Integration coverage:** Server public-boundary tests cover settings, deck, clues, play, and completion; browser verification covers affordances and styling.
- **Unchanged invariants:** Hand sizes, turn order, clue/fuse caps, final round, and non-Black-Powder behavior stay intact.

---

## Risks & Dependencies

| Risk                                                       | Mitigation                                                                                      |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Black tile rendering is confused with a hidden tile        | Give visible black tiles a light ash face, black numeral, inset bevel, and stack direction cue. |
| UI hides an illegal action but the server still accepts it | Keep the current whitelist server-side and add rejection coverage.                              |
| Completion count and displayed score are conflated         | Use separate shared helpers for six-stack completion and 25-point scoring.                      |

---

## Documentation / Operational Notes

- The requirements and plan capture the published source links and the deliberate exclusion of combination variants.
- No environment, deployment, or data migration work is required.
