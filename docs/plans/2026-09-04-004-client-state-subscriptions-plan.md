# Isolate Hanabi client subscriptions and board presentation

Chat messages and bot execution status must update immediately without starting,
canceling, or delaying card animations. The server continues sending complete,
recipient-filtered snapshots through the existing socket protocol.

## Implementation

- [x] ✅ Publish authoritative snapshots through a stable client store with separate
      board, activity, and bot-status channels. Reuse unchanged JSON branches. Keep
      gameplay event tracking independent of chat retention in the mixed action log.
- [x] ✅ Move the animation coordinator and delayed presentation into the board
      subtree. Move tile-position overrides with it. Migrate chat/status adapters and
      gameplay hooks to the appropriate subscriptions; keep fixtures/review independent.
- [x] ✅ Verify immediate chat/status delivery during pending and active animations,
      unchanged tile renders, history retention, reset/reconnect/unmount, existing
      gameplay behavior, and browser rendering. Run tests, typecheck, lint, and build.
      All 662 tests pass (one environment-gated test skipped); typecheck, lint, and
      production builds pass. IAB verification covers the fixture, a fresh live room,
      clue delivery, a successful play, and root snapshot exclusion. Deferred-capture
      React tests prove chat/status bypass the coordinator and preserve tile renders.

## Boundaries

No added state library, server protocol changes, gameplay changes, or persistence
changes. Live snapshots conceal the deck seed, so reset detection also uses stage
and action lineage. Chat and arbitrary status updates never enter the board
animation coordinator.
