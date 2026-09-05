---
date: 2026-09-04
topic: conventions-and-result-reflection
---

# Hanabi conventions and result reflection

## Problem

The bot's shared conventions need to describe resource management, deliberate deviations,
multiplayer coordination, finesses, and emergency signals. A bot also needs to interpret the
revealed outcome of its own play or discard promptly, including when physical card movement is disabled.

## Requirements

- R1. Assume players follow the shared conventions. Interpret both compliance and departures as
  meaningful evidence while allowing for mistakes and different visible information.
- R2. Treat clues and lives as resources. Budget clues for upcoming obligations and consider the
  restricted actions at zero or maximum clues. Preserve the possibility of a perfect score.
- R3. Preserve cards conceptually when dragging is disabled. Track the effective discard queue
  and card acquisition order without requesting physical movements.
- R4. Explain responsibility in seating order and how a safe action can oblige later players to
  clue or play. Reassess predicted action sequences when players have different information.
- R5. Explain the blue-1/blue-2 finesse, prioritizing an already-clued plausible connecting card
  over a blind newest-card play. Qualify conflicting immediate-play rules explicitly.
- R6. An emergency clue induces a normal play; its failure reveals the warning. Only then does
  the recipient reassess and reserve endangered cards, often the two oldest discard candidates.
  Other deliberate departures also call for conservative reassessment.
- R7. After each bot play or discard, offer that bot one result response before scheduling another
  bot turn. Include the revealed action, updated hand, full public history, and its private notepad.
  Keep its own replacement card concealed. Giving a clue does not cause this follow-up.
- R8. Result responses may update notes and optionally rearrange the current hand. They cannot
  take a gameplay action. Disabled dragging forbids movement; terminal results permit notes only.
- R9. Keep result responses brief: low reasoning effort, 2,048 output tokens, a five-second deadline,
  and no automatic retry. Skip failed responses; preserve the action in history for later reasoning.
- R10. Persist pending result work and accepted notes, validate their source action, and reject stale
  responses after state changes or resets. Preserve the exact policy and behavior of older saved rounds.

- R11. In games without Black Powder, prioritize protecting threatened 2s early, including the opening retention-clue window before 1s are played; avoid unnecessary reservations of 3s and 4s.
- R12. In two-player games, slightly prefer a useful clue or safe play after a partner discards a needed 3 or 4, preserving a chance to warn about a matching last copy.

## Verification

Cover successful plays, failed plays, discards, disabled dragging, terminal outcomes, post-draw
layouts, persistence, invalid or stale responses, and failure recovery. Check provider limits and
the correct bot's visible status. Run lint, typecheck, relevant tests, and formatting checks.

## Scope

Update `apps/server/src/games/hanabi/bots/conventions.md`, the bot result-response workflow, its
status display, and supporting documentation. Gameplay rules, human action permissions, and
existing saved policy snapshots remain intact. No new clue-only reflection when dragging is disabled.

## Work checkpoints

- ✅ Integrate the shared conventions and qualified exceptions. The conventions document covers resource management, reservations, multiplayer coordination, finesses, and emergency signals.
- ✅ Implement the bounded result-response contract, scheduling, persistence, and status. Result responses use low effort, a 2,048-token limit, and a five-second deadline per attempt; failed responses are skipped.
- ✅ Verify behavior and compatibility with automated checks. The full suite passed 706 tests with one environment-dependent skip after integration with the current main branch. Lint, typecheck, production builds, and browser inspection of the result status passed.
