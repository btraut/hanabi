# Live Desktop Fidelity Requirements

## Problem frame

The approved desktop mock has the right hierarchy, density, and visual character, but the real game diverges from it in ordinary play and collapses into an obsolete visual system below 1280px. At narrower widths the dark tabletop abruptly becomes a white prototype, chat/history jumps ahead of the board, fixed-width hands overflow phones, and the header clips. The implementation must preserve one coherent game surface through continuous resizing rather than treating tablet and mobile as a separate application.

The visual thesis is a dense, luminous navy tabletop whose hierarchy survives both sparse and dense game states. Game state supplies the content density; the surfaces, spacing, and responsive rules supply the polish.

## Actors and key flows

- A local player scans the turn, score, tableau, hands, and activity before acting.
- A player gives a clue, plays, or discards a card from either the ordered or freeform half of their hand.
- A player adds or reads private card notes without hiding neighboring cards.
- Players review history, switch to chat, notice unread messages, and send a message.
- Two to five isolated browser clients join, play, reload, and deep-link back into the same game.

## Requirements

- **R1 — Approved hierarchy:** At the target wide-desktop viewport, the real game must reproduce the approved three-zone composition: tableau left, player workspaces center, activity rail right, with turn and status above the play surface.
- **R2 — Compact desktop integrity:** At common narrower desktop widths, no status item, player card, tableau lane, activity content, or control may collide, clip, or create horizontal page overflow.
- **R3 — Complete status:** Score, deck, clues, and lives must remain visible and legible in every desktop composition.
- **R4 — Split hand integrity:** Every player workspace must preserve a clear horizontal split between its ordered upper zone and freeform lower zone without adding explanatory labels.
- **R5 — Notes affordance:** A local card-note control must remain card-sized, visually subordinate, and spatially attached to the relevant card. It must never expand into an overlay that obscures the hand or exposes clipped card fragments.
- **R6 — Drag integrity:** Drag previews, drop targets, and card transforms must preserve the real card proportions and must not distort, duplicate, or crop neighboring cards.
- **R7 — Sparse tableau quality:** An empty color lane must read as one intentional play placeholder with room reserved for its chronological discard queue. It must not show nested empty outlines or appear broken.
- **R8 — Dense tableau fidelity:** Each color must display its played card and its own chronological discard queue. Queues of five or six cards must remain readable; longer queues may compact without changing order.
- **R9 — Player-count resilience:** Real games with two through five players must remain balanced and usable. Sparse games must not fabricate players or actions, and dense games must not collapse into illegible stacks.
- **R10 — Real activity parity:** The Latest card, history list, chat tab, unread count, and composer must have the same structure and visual treatment in the live game as in the approved fixture. Fixture-only behavior is not acceptable.
- **R11 — State accuracy:** Turn ownership, active-player emphasis, local-player identity, clue colors, timestamps, and action colors must remain driven by real game state.
- **R12 — Asset fidelity:** The approved card faces, card backs, landmark art, firework marks, color treatment, borders, and glow language must be used consistently in live gameplay.
- **R13 — Responsive transition:** The approved dark game surface must remain the sole production composition at every supported width. Desktop uses three columns; tablet uses a deliberate two-column play area with activity below; mobile uses one column ordered as turn/status, tableau, player workspaces, then History/Chat. Continuous resizing must never reveal the legacy white board, horizontal page overflow, clipped controls, or unreachable card interactions.
- **R14 — Browser proof:** Acceptance requires a real game with at least two isolated browser players, an action that changes shared state, a reload, and a direct game-route load.
- **R15 — Quality gates:** The changed code must pass focused browser assertions, lint, typecheck, tests, production builds, and maximum-ruleset overflow checks.

## Acceptance examples

1. At 1586×992, a populated four-player game visually matches the approved mock’s composition and density while preserving the exact live state.
2. At approximately 1393×908, a two-player game shows all four status values, the complete activity rail, both halves of each hand, and no overlapping panels.
3. Opening or editing a card note produces a card-sized control and never covers the hand row.
4. A lane with no played or discarded cards shows one coherent placeholder. A lane with six discards shows all six in chronological order.
5. A chat message from another browser produces an unread indicator; opening Chat clears it according to the existing semantics.
6. Reloading either player and directly opening the game URL restores a usable board without a transient identity or layout failure.
7. Continuously resizing from 1600px through 1280px and 1279px produces a reflow, not a visual-system swap; all game state remains present.
8. At 1024px the play area uses two columns; by 768px it reflows to one. In both compositions tableau and hands remain readable, activity follows the play area, and the page has no horizontal overflow.
9. At 390px and 360px, the header, all four status values, every per-color discard queue, both hand zones, activity tabs, and chat composer fit the viewport and remain usable without horizontal scrolling.

## Scope boundaries

- Gameplay rules and server protocol semantics are unchanged.
- Real state is never padded with fake players, cards, discards, or history entries for visual density.
- The approved desktop mock is the aesthetic reference for the tablet and mobile composition; responsive work changes hierarchy and density, not the game rules or visual language.
- One- or two-pixel differences are not acceptance failures unless they create a visible rhythm, hierarchy, clipping, or behavior problem.

## Key decisions

- Dense and sparse states share one design system, but sparse states receive deliberate empty-state structure.
- Desktop geometry is responsive within the desktop range; fixed mock coordinates are not the implementation model.
- Interactive production components, not fixture-only replicas, are the source of truth for acceptance screenshots.

## Open questions

None block implementation. Existing gameplay semantics remain authoritative where the mock is silent.

## Verification

- ✅ Replaced the production desktop/legacy render switch with one continuously mounted modern board.
- ✅ Verified 1600, 1280/1279, 1024/1023, 960/959, 768/767, 640/639, 480, 390, and 360px widths with no horizontal document overflow.
- ✅ Verified a 1280×600 short viewport keeps the activity composer visible.
- ✅ Verified History/Chat selection survives breakpoint round trips and tile overlays close cleanly on resize.
- ✅ Verified a real 390px card drag maps into the canonical ordered/freeform board coordinates.
- ✅ Passed lint, typecheck, 180 tests, server build, web production build, and `git diff --check`.
