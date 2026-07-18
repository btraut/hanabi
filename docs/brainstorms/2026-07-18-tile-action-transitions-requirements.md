---
date: 2026-07-18
topic: tile-action-transitions
---

# Tile Action Transitions

## Problem Frame

Playing or discarding a tile currently removes it from a player's hand and renders it at its destination in the same state update. Every observer sees two disconnected changes instead of one understandable movement, making turns feel abrupt and obscuring which tile moved where.

## Requirements

- R1. Every player and spectator sees an acted tile move visually from its rendered position in the acting player's hand to its resulting board destination.
- R2. A successful play moves to the matching played stack; a discard or failed play moves to the discard area.
- R3. The destination state remains visually coherent while the tile is moving, without showing a distracting duplicate tile at both endpoints.
- R4. Ordinary hand reordering retains its existing drag behavior and does not trigger or compete with action transitions.
- R5. The transition respects reduced-motion preferences while preserving an understandable state change.
- R6. Unplayed firework positions remain visible as subdued guides that cannot be mistaken for played tiles.
- R7. Played tiles land over their existing position guides without retaining hand-only clue highlights, note indicators, drag behavior, or clue hover interactions.

## Success Criteria

- An observer can identify which tile left which hand and whether it was played or discarded without relying on the action log.
- Action transitions run from authoritative game updates for both the acting client and remote observers.
- Tiles remain draggable before an action and after the resulting hand state settles.
- The firework guide remains visually stable during a play, and the landed tile is clearly distinct from every unplayed position.

## Scope Boundaries

- This work does not replace the current drag-and-drop system or change gameplay rules.
- Clue animations and broad board-motion redesign are excluded.
- Replacement draw motion is secondary to clearly communicating the played or discarded tile and should not obscure that movement.

## Key Decisions

- Animate for every observer: the movement explains shared game state, not merely local input feedback.
- Use the tile's actual rendered source and destination: a generic fade or fixed trajectory would not explain spatial movement.
- Failed plays land in the discard area: the animation follows the tile's resulting game state.

## Implementation Reference

See `docs/plans/2026-07-18-001-feat-animate-tile-actions-plan.md` for the technical approach and verification scope.
