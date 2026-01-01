# Hanabi Modernization Spec

## Context
The current project uses a single-package layout with webpack for client + server builds, React 17, and legacy tooling. The goal is a full modernization that preserves runtime behavior while upgrading tooling, dependency versions, and repository structure. The migration is a direct cutover; legacy build configs can be removed during the process.

## Goals
- Preserve application behavior (UI, routing, websocket interactions, server responses).
- Modernize build tooling (Vite, Nx, pnpm), upgrade dependencies (React 19 and others), and standardize on Node v24.11.1.
- Establish a simple monorepo with two apps: `apps/web` and `apps/server`.
- Improve developer experience: fast HMR, consistent lint/typecheck, clear scripts.

## Non-Goals
- Introducing SSR or altering rendering strategy (keep SPA behavior).
- Creating separate UI/design system packages.
- Re-architecting websocket usage (keep long-lived Node websocket server).

## Target Architecture
### Repo Layout
```
apps/
  web/
  server/
packages/
  (none for now)
```

### Apps
- `apps/web`: Vite + React 19 SPA. No SSR.
- `apps/server`: Node 24.11.1 + Express + Socket.IO (or ws). Long-lived websocket server remains in Node process.

### Tooling
- Package manager: pnpm workspaces.
- Monorepo: Nx.
- Build: Vite for web; Node-targeted TS build for server (tsc/tsx via Nx targets).
- Lint/format: ESLint 9 flat config + Prettier 3.
- TypeScript: 5.7 with root `tsconfig.base.json` and per-app configs.
- Runtime: Node v24.11.1 enforced via `.tool-versions` and `mise.toml` (mirroring `/Users/btraut/Development/decklist/`).
- Styling: upgrade to the latest Tailwind CSS (expect config changes).

## Environment & Config
- `.env` remains for development secrets.
- Explicitly separate server-only envs from client-exposed envs (use `VITE_` prefix for client).
- Centralize environment access in a config module for server and client.

## Dependency Strategy
- Aggressive upgrades to latest majors, including React 19 and the latest Tailwind CSS (with config updates as needed).
- If a dependency upgrade changes behavior (e.g., router), either apply minimal migration changes or pin to the newest compatible version to preserve behavior.

## Build Outputs
- Web build artifacts in `dist/apps/web`.
- Server build artifacts in `dist/apps/server`.

## Development Workflow
- `nx run-many -t dev --projects web,server` to run both apps.
- Explicit ports and HMR config for websocket stability (mirror decklist Vite config patterns).

## Migration Strategy (Direct Cutover)
- Introduce new monorepo layout and tooling.
- Move code into `apps/web` and `apps/server`.
- Replace webpack with Vite; delete legacy webpack config and root scripts during migration.
- Upgrade dependencies aggressively; validate parity via smoke tests.

## Parity Checklist
- Login/auth flows
- Game creation/joining
- Websocket connection stability (long-lived)
- Real-time game updates
- UI rendering and asset loading

## Acceptance Criteria
- `pnpm install` works from repo root.
- `nx dev` launches both web and server with working websockets.
- `nx build` produces `dist/apps/web` and `dist/apps/server`.
- All parity checklist items pass manual verification.
- Legacy webpack configs and scripts are removed.

## Open Questions
- Choose server build target implementation (tsc/tsx/esbuild) per Nx defaults and runtime needs.
- Confirm preferred websocket library (Socket.IO vs ws), or keep current Socket.IO.
