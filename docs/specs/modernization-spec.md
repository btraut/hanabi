# Hanabi Modernization Spec

## Context
The current project uses a single-package layout with Webpack 5 for client + server builds, React 17, and legacy tooling (Tailwind v2, React Router v5, Socket.IO v3). The goal is a full modernization that preserves runtime behavior while upgrading tooling, dependency versions, and repository structure. The migration is a direct cutover; legacy build configs can be removed during the process.

## Goals
- Preserve application behavior (UI, routing, websocket interactions, server responses).
- Modernize build tooling (Vite, Nx, pnpm), upgrade dependencies (React 19, Tailwind v4, React Router v7), and standardize on Node v24.11.1.
- Establish a simple monorepo with two apps: `apps/web` and `apps/server`.
- Improve developer experience: fast HMR, consistent lint/typecheck, clear scripts.

## Non-Goals
- Introducing SSR or altering rendering strategy (keep SPA behavior).
- Creating separate UI/design system packages.
- Re-architecting websocket usage (keep long-lived Node websocket server).

## Current State (Pre-Migration)
- **Build**: Webpack 5 with ts-loader, Babel 7
- **React**: 17.0.1
- **Router**: React Router v5.2.0
- **Styling**: Tailwind CSS v2.0.2
- **WebSockets**: Socket.IO v3.0.4 (client + server)
- **TypeScript**: 5.4.3
- **Package Manager**: Yarn 1.x
- **Structure**: Single package with `app/src/` containing both client and server code

## Target Architecture

### Repo Layout
```
apps/
  web/          # Vite + React 19 SPA
  server/       # Node + Express + Socket.IO
packages/
  (none for now)
```

### Apps
- `apps/web`: Vite + React 19 SPA. No SSR.
- `apps/server`: Node 24.11.1 + Express + Socket.IO v4. Long-lived websocket server remains in Node process.

### Tooling
- **Package manager**: pnpm workspaces
- **Monorepo**: Nx with `nx:run-commands` executor pattern (following decklist)
- **Build**:
  - Web: Vite with `vite-tsconfig-paths`
  - Server: `tsx` for dev (watch mode), `tsc` for production builds
- **Lint/format**: ESLint 9 flat config (`eslint.config.mjs`) + Prettier 3
- **TypeScript**: 5.7+ with root `tsconfig.base.json` and per-app configs (build, typecheck variants)
- **Runtime**: Node v24.11.1 enforced via `.tool-versions` + `.envrc` (mise/direnv)
- **Styling**: Tailwind CSS v4 (CSS-first config)

### Key Dependencies (Target Versions)
| Package | Current | Target |
|---------|---------|--------|
| React | 17.0.1 | 19.x |
| React Router | 5.2.0 | 7.x |
| Tailwind CSS | 2.0.2 | 4.x |
| Socket.IO | 3.0.4 | 4.x |
| TypeScript | 5.4.3 | 5.7+ |
| ESLint | 8.46.0 | 9.x |

## Environment & Config
- Per-app `.env` and `.env.example` files
- Explicitly separate server-only envs from client-exposed envs (use `VITE_` prefix for client)
- Centralize environment access in `env.ts` modules for server and client

## Build Outputs
- Web build artifacts in `dist/apps/web`
- Server build artifacts in `dist/apps/server`

## Development Workflow
- `pnpm dev` → `nx run-many -t dev --projects web,server`
- Explicit ports and HMR config for websocket stability
- Helper script `scripts/run-pnpm.sh` for Nx executor commands

---

## Migration Phases

### Phase 1: Monorepo Scaffolding ✅
Set up the monorepo structure without moving code yet.

- [x] Install pnpm globally, remove yarn.lock
- [x] Create `pnpm-workspace.yaml` with `apps/*` pattern
- [x] Create root `package.json` with workspace scripts
- [x] Create `nx.json` with named inputs, target defaults, and caching config
- [x] Create `tsconfig.base.json` with shared compiler options and path aliases
- [x] Create `.tool-versions` (Node 24.11.1, pnpm latest)
- [x] Create `.envrc` for mise/direnv integration
- [x] Create `eslint.config.mjs` (ESLint 9 flat config)
- [x] Create `scripts/run-pnpm.sh` helper
- [x] Scaffold empty `apps/web/` and `apps/server/` directories with `package.json` and `project.json`

### Phase 2: Server App Migration ✅
Move and modernize the server code.

- [x] Move server source files from `app/src/` to `apps/server/src/`
  - `server.tsx` → `apps/server/src/main.ts`
  - Server-side utilities, models, game logic
- [x] Create `apps/server/tsconfig.json` (extends base, Node16 module)
- [x] Create `apps/server/tsconfig.build.json` for production builds
- [x] Set up `apps/server/package.json` with scripts: dev (tsx watch), build (tsc), start
- [x] Create `apps/server/project.json` with Nx targets
- [x] Upgrade Socket.IO from v3 to v4 (minimal API changes)
- [x] Create `apps/server/.env.example` with server env vars
- [x] Create `apps/server/src/env.ts` for centralized env access
- [x] Verify server starts and accepts websocket connections

**Implementation Notes:**
- Created `packages/shared/` for shared types/utilities (HanabiGameData, SocketMessage, PubSub, etc.)
- Using `express.json()` instead of body-parser (built into express 4.16+)
- Redis client upgraded to v4 API (async connect)
- TypeScript project references for cross-package imports

### Phase 3: Web App Migration ✅
Move and modernize the client code.

- [x] Create `apps/web/vite.config.ts` with React plugin, tsconfig-paths, Tailwind v4
- [x] Move client source files from `app/src/` to `apps/web/src/`
  - `client.tsx` → `apps/web/src/main.tsx`
  - Components, pages, client utilities
- [x] Move `app/index.html` → `apps/web/index.html` (update script src)
- [x] Move static assets (`app/images/`, `app/sounds/`) → `apps/web/public/`
- [x] Create `apps/web/tsconfig.json` (extends base, ESNext module, Bundler resolution)
- [x] Set up `apps/web/package.json` with scripts: dev, build, preview
- [x] Create `apps/web/project.json` with Nx targets
- [ ] Create `apps/web/.env.example` with `VITE_` prefixed vars (deferred - no client env vars needed yet)
- [ ] Create `apps/web/src/env.ts` for client env access (deferred - no client env vars needed yet)

**Implementation Notes:**
- Updated imports to use `~/` path alias for local imports and `@hanabi/shared` for shared types
- Fixed react-dnd v14 API changes (useDrag now takes a factory function)
- Tailwind v4 uses CSS-first config via `@import "tailwindcss"` and `@theme`
- Removed duplicate types/utilities that now live in @hanabi/shared
- Added missing dependencies: classnames, boring-avatars, react-focus-lock, tailbreak, store

### Phase 4: Dependency Upgrades ✅
Upgrade major dependencies with necessary code migrations.

- [x] Upgrade React 17 → 19
  - Updated `react`, `react-dom` packages to v19
  - React 19 does NOT include types - kept `@types/react`, `@types/react-dom`
  - Updated `main.tsx` to use `createRoot` API
  - Created `global.d.ts` to re-export JSX namespace for backward compatibility
  - Updated `useRef()` calls to include initial values (React 19 types require this)
- [x] Upgrade React Router v5 → v7
  - Replaced `<Switch>` with `<Routes>`
  - Replaced `<Route component={X}>` and `<Route children>` with `<Route element={<X />}>`
  - Updated `useHistory()` → `useNavigate()` (navigate() instead of history.push())
  - Updated imports from `react-router` to `react-router-dom`
- [x] Upgrade Tailwind CSS v2 → v4 (done in Phase 3)
  - Removed `tailwind.config.js` (v4 is CSS-first)
  - Created CSS-first config with `@import "tailwindcss"` and `@theme`
- [x] Upgrade Socket.IO client to v4 (done in Phase 3)
- [x] Upgrade react-dnd to v16 (React 19 compatible)
- [x] Remove Babel (Vite handles transforms)
- [x] Remove webpack and related loaders

**Implementation Notes:**
- React 19's stricter types required updating event handler types from `HTMLDivElement` to `HTMLElement` for components that can render as either button or div
- react-dnd's ref types don't fully match React 19's ref types - used `as any` casts where needed
- `useRef()` now requires an initial value (null) in React 19 types

### Phase 5: Cleanup & Verification ✅
Remove legacy config and verify parity.

- [x] Delete legacy files:
  - `webpack.config.ts`
  - `.babelrc`
  - `tailwind.config.js`
  - `postcss.config.js`
  - `yarn.lock` (already removed in Phase 1)
  - `app/` directory
  - `.build/` directory
- [x] Update root `package.json` to remove old scripts
- [x] Run full lint, typecheck, format from root
  - Typecheck passes on all projects
  - Lint has pre-existing issues (not introduced by migration)
- [ ] Manual verification of parity checklist (to be done by user):
  - [ ] Login/auth flows work
  - [ ] Game creation/joining works
  - [ ] Websocket connection is stable (long-lived)
  - [ ] Real-time game updates work
  - [ ] UI renders correctly with all styles
  - [ ] Assets (images, sounds) load correctly
- [x] Update README with new dev workflow
- [x] AGENTS.md already up to date

---

## Acceptance Criteria
- `pnpm install` works from repo root
- `pnpm dev` launches both web and server with working websockets
- `pnpm build` produces `dist/apps/web` and `dist/apps/server`
- `pnpm lint && pnpm typecheck` pass
- All parity checklist items pass manual verification
- Legacy webpack configs and scripts are removed

## Decisions Made
- **Server build**: `tsx` for dev (fast watch), `tsc` for production (following decklist pattern)
- **WebSocket library**: Keep Socket.IO, upgrade to v4 (stable, well-supported, minimal migration)
- **Tailwind version**: v4 (CSS-first config, latest features)
- **React Router**: Aggressive upgrade to v7 (latest, better patterns)
