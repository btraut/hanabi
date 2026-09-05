# Game review proof of concept

The desktop prototype adds independent, read-only review of completed Hanabi rounds using recorded turns, hand movements, and the live board components. It follows the approved screenshot concept: perspective selector above the board, chronological moves beside it, and discrete transport controls below it.

## Work and verification

- ✅ Shared transcript types and deterministic reconstruction, including hidden-information projection. Tests cover deal/draw order, clues, terminal moves, rulesets, and immutable source data.
- ✅ Complete transcripts are delivered only with finished-game snapshots. Server tests verify live games, reset rounds, partial/conflicted legacy recordings, recipient isolation, and reconstruction parity at every move of an actual game. Abandoned games remain in progress internally and do not qualify.
- ✅ Results and finished-board entry points, independent review state, a single Perspective dropdown with All hands above a divider and the players below, move selection, slider, and keyboard stepping. Integration tests confirm an open review survives a lobby reset and exit returns to the current lobby without sending gameplay actions.
- ✅ Development-only sample round at `/dev/review`, generated through the real game server. Chrome checks cover stepping, perspective visibility, reveal-all, end state, exits, and 390px-wide layout with document width exactly 390px. Mobile uses a normal-flow move list; the polished drawer remains deferred.
- ✅ Verification executed: 35 focused review tests pass; repository-wide typecheck, lint, and production builds pass. Full suite: 329 passed and 1 skipped. Chrome checks confirm the combined dropdown switches between player visibility and all hands without a separate checkbox.

## Live-board parity and movement history

- ✅ Review reuses the live scoreboard and red turn banner, including score, deck, clues, and lives. Player hands use the live two-zone dimensions and tile positioning.
- ✅ Every accepted position change is recorded independently of gameplay turns, with exact layouts preserved through draws and game restoration. Persistence reconciliation protects movement history and ordering.
- ✅ The scrubber, step list, keyboard navigation, and rewind include hand rearrangements while retaining gameplay turn numbers and hidden-information rules.
- ✅ Full suite: 350 tests passed, one database integration test skipped. Repository lint and typecheck passed. Chrome verification covered desktop and 390×844 layouts, consecutive non-turn movements, persistence through a clue, and rewind to the original deal; mobile document width remained 390px.

## Boundaries

Cursor zero is the initial deal. Cursor N is the board after N review steps, including accepted hand rearrangements. Turn numbers count only plays, discards, and clues. Each completed reposition that changes a tile position is a separate step, including movement outside the current player’s turn; rejected requests and unchanged positions create no step. Future move decisions stay hidden until reached. Reveal all hands does not reveal the draw pile. The player perspective does not reorder workspaces. New recordings preserve initial positions, hand movements in server acceptance order, and positions after each gameplay action, including draw/reflow. Older transcripts without positions remain reviewable using canonical hand positions; movements that were never recorded cannot be reconstructed. Chat is not recorded. Review reuses the live scoreboard, red turn banner, and two-zone hand geometry without enabling gameplay controls.

Persisted review links, admin entry, synchronized coaching, autoplay, annotations, and a polished mobile drawer are deferred. The prototype must still fit narrow screens. It does not change gameplay rules or require a database to review a newly completed round.
