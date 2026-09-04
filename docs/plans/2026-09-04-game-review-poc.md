# Game review proof of concept

The desktop prototype adds independent, read-only review of completed Hanabi rounds using the existing transcript format and board artwork. It follows the approved screenshot concept: perspective selector above the board, chronological moves beside it, and discrete transport controls below it.

## Work and verification

- ✅ Shared transcript types and deterministic reconstruction, including hidden-information projection. Tests cover deal/draw order, clues, terminal moves, rulesets, and immutable source data.
- ✅ Complete transcripts are delivered only with finished-game snapshots. Server tests verify live games, reset rounds, partial/conflicted legacy recordings, recipient isolation, and reconstruction parity at every move of an actual game. Abandoned games remain in progress internally and do not qualify.
- ✅ Results and finished-board entry points, independent review state, a single Perspective dropdown with All hands above a divider and the players below, move selection, slider, and keyboard stepping. Integration tests confirm an open review survives a lobby reset and exit returns to the current lobby without sending gameplay actions.
- ✅ Development-only sample round at `/dev/review`, generated through the real game server. Chrome checks cover stepping, perspective visibility, reveal-all, end state, exits, and 390px-wide layout with document width exactly 390px. Mobile uses a normal-flow move list; the polished drawer remains deferred.
- ✅ Verification executed: 35 focused review tests pass; repository-wide typecheck, lint, and production builds pass. Full suite: 329 passed and 1 skipped. Chrome checks confirm the combined dropdown switches between player visibility and all hands without a separate checkbox.

## Boundaries

Cursor zero is the initial deal. Cursor N is the board after N gameplay actions. Future move decisions stay hidden until reached. Reveal all hands does not reveal the draw pile. The player perspective does not reorder workspaces. Historical card dragging and chat are not recorded; review uses canonical hand positions and recorded clue knowledge.

Persisted review links, admin entry, synchronized coaching, autoplay, annotations, and a polished mobile drawer are deferred. The prototype must still fit narrow screens. It does not change gameplay rules or require a database to review a newly completed round.
