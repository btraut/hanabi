---
date: 2026-07-16
topic: hanabi-rebuild
---

# Hanabi Rebuild Requirements

## Problem Frame

Hanabi still serves real players from Heroku, but the current repository cannot be trusted as a maintainable or deployable source of that product. A prior migration moved the code to pnpm, Nx, Vite, React 19, React Router 7, Tailwind 4, Express, and Socket.IO 4, then declared completion without testing browser gameplay or production startup. The current tree compiles, but development ports collide across worktrees, production points at deleted build artifacts, browser-only regressions remain, websocket cleanup is incorrect, lint and formatting fail, and no automated tests exist.

The first rebuild milestone is behavioral parity on a coherent modern stack. New gameplay features come after developers can start any worktree safely, deploy the application, and prove a complete multiplayer game flow in independent browser sessions.

---

## Actors

- A1. Player: Creates, joins, watches, and plays a Hanabi game from a browser.
- A2. Developer: Runs and changes multiple worktrees without port collisions or hidden setup.
- A3. Operator: Builds, deploys, starts, and diagnoses the production application.

---

## Key Flows

- F1. Local development startup
  - **Trigger:** A2 starts Hanabi from any branch or worktree.
  - **Actors:** A2
  - **Steps:** The launcher derives stable worktree-specific ports, avoids occupied ports, starts the web and game services, records their actual URLs, and exposes readiness or failure clearly.
  - **Outcome:** This worktree runs without colliding with another Hanabi worktree, and tools can discover its URLs without guessing.
  - **Covered by:** R3, R4, R11

- F2. Multiplayer game
  - **Trigger:** One A1 creates a game and another A1 opens the shared game URL.
  - **Actors:** A1
  - **Steps:** Each browser receives a distinct session, connects and authenticates its socket, joins the lobby, starts the game, performs an action, and observes synchronized state from the other browser.
  - **Outcome:** Both players see consistent game state and can continue after an ordinary network reconnect.
  - **Covered by:** R2, R5, R6, R7, R10, R12

- F3. Production deployment
  - **Trigger:** A3 deploys a clean checkout using the documented production commands.
  - **Actors:** A3
  - **Steps:** Dependencies install, web and server artifacts build, one production command starts the app, static navigation resolves, and API/websocket traffic reaches the long-lived game process.
  - **Outcome:** The deployed app serves playable Hanabi without relying on deleted or untracked artifacts.
  - **Covered by:** R1, R2, R8, R9, R11

---

## Requirements

**Application architecture**

- R1. The browser application remains a client-rendered Vite SPA using React and React Router; TanStack Start and SSR are not part of this milestone.
- R2. Express and Socket.IO remain the authoritative long-lived game process so in-memory connections, rooms, and game state are not forced into request-scoped or serverless handlers.
- R3. Every worktree receives stable preferred web and server ports derived from its worktree path, with collision detection and deterministic fallback when a preferred port is occupied.
- R4. The development launcher writes the resolved ports and URLs to a machine-readable, ignored manifest that browser automation and humans can query.

**Behavioral parity and reliability**

- R5. Existing routes (`/`, `/join`, and `/:code`), styles, sounds, game creation, joining, watching, lobby configuration, gameplay actions, chat, and game reset behavior remain available.
- R6. A first-time browser session receives a durable user identity and can authenticate its Socket.IO connection in both proxied development and production deployments.
- R7. Disconnect and reconnect handling removes stale socket state without declaring a multi-tab user offline while another authenticated socket remains active.
- R8. Production build and start commands use only generated artifacts from the current source tree and work with Heroku's process model.

**Modernization and proof**

- R9. Direct dependencies are upgraded to current compatible releases, mismatched runtime/type packages are aligned, obsolete build-era dependencies and globals are removed, and formatting, lint, typecheck, and build commands pass.
- R10. Automated tests characterize game rules, session/socket integration, and the critical browser multiplayer flow before deeper protocol changes are attempted.
- R11. Development and production startup expose readiness, actionable failures, and documented commands rather than relying on implicit fixed ports or stale generated files.
- R12. Completion requires visual proof from at least two isolated browser sessions acting as different players, including screenshots of the shared lobby/game and synchronized turn results. If the flow fails, the migration remains incomplete.

---

## Acceptance Examples

- AE1. **Covers R3, R4.** Given two Hanabi worktrees, when both run concurrently, each publishes different web and server URLs and both remain reachable.
- AE2. **Covers R5, R6, R12.** Given two clean browser sessions, when player one creates a game and player two joins its code, both appear in the same lobby with distinct identities.
- AE3. **Covers R5, R7, R10, R12.** Given a started two-player game, when each player performs a legal turn and one session reconnects, both sessions converge on the same game state without duplicating or losing the player.
- AE4. **Covers R8, R11.** Given a clean production build, when the documented start command runs, the root page, a deep game URL, the auth API, and a Socket.IO handshake all succeed from the production server.

---

## Success Criteria

- A player can create and play a two-player game without knowing the application was rebuilt.
- A developer can run simultaneous worktrees and hand a browser or test tool the manifest URL instead of coordinating ports manually.
- A clean checkout passes formatting, lint, typecheck, build, automated tests, and the isolated multi-browser proof flow.
- Production startup no longer depends on the deleted `.build/server/server.js` path or tracked build output.

---

## Scope Boundaries

- New gameplay features and a visual redesign are deferred until parity is proven.
- SSR and TanStack Start are excluded because they add runtime complexity without value for this websocket-driven SPA.
- A wholesale Socket.IO protocol rewrite, event-sourcing model, or distributed game-state architecture is deferred until characterization and browser coverage exist.
- Replacing React DnD, the local file/Redis persistence choices, or Heroku is not required for this milestone unless current behavior cannot be restored safely without doing so.

---

## Key Decisions

- Use Vite + React Router library mode: the application already owns its realtime data lifecycle, so a full-stack rendering framework would be machinery without leverage.
- Derive ports from the worktree path, not the branch name: Codex worktrees may be detached and branch names can change while running processes still belong to the worktree.
- Keep Express + Socket.IO through the parity milestone: the existing game model assumes a long-lived process and the library remains current and well supported.
- Treat browser proof as a release gate: compilation cannot catch session, styling, routing, drag-and-drop, or cross-client synchronization failures.

---

## Dependencies / Assumptions

- Node 24 remains the local and production runtime target.
- The checked-in game behavior is the authoritative parity baseline because the repository has no historical automated suite and the live Heroku URL/configuration is not recorded here. The live app should be compared when discoverable, with any drift documented rather than silently copied.
- Local file persistence is sufficient for development and browser proof; Redis remains available for production compatibility.

---

## Outstanding Questions

### Deferred to Planning

- [Affects R8][Technical] Whether the production web assets should be served by Express or a separate static host after parity is restored.
- [Affects R9][Needs research] Which major dependency upgrades can land safely in the parity milestone versus follow-up changes with their own migration tests.
- [Affects R10][Technical] The smallest game-rule characterization boundary that protects protocol work without freezing accidental implementation details.

---

## Next Steps

-> `ce-plan` for structured implementation planning
