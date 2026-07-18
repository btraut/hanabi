# Hanabi

An online multiplayer Hanabi game.

## Development Environment

This project uses:

- **pnpm** for package management
- **Nx** for monorepo task orchestration
- **Vite** for web client bundling
- **tsx** for server development
- **TypeScript** throughout

### Prerequisites

1. **Node.js v24.11.1** - Use [mise](https://mise.jdx.dev/) with direnv:

   ```bash
   mise install
   direnv allow
   ```

   Or install Node directly from [nodejs.org](https://nodejs.org/).

2. **pnpm** - Install globally:
   ```bash
   npm install -g pnpm
   ```

### Installation

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Set up environment variables:
   ```bash
   cp apps/server/.env.example apps/server/.env
   # Edit .env with your credentials
   ```

### Development

Start both web and server in development mode:

```bash
pnpm dev
```

This assigns deterministic, collision-safe ports from the Git worktree path, starts both services,
and writes the authoritative URLs to `.context/dev/current.json`. Different worktrees can run at the
same time without fighting over ports. Use `pnpm dev:status` to print the current URLs and
`pnpm dev:down` to stop the launcher.

### Available Commands

| Command             | Description                           |
| ------------------- | ------------------------------------- |
| `pnpm dev`          | Start web and server in dev mode      |
| `pnpm build`        | Build all apps for production         |
| `pnpm test`         | Run Vitest unit and integration tests |
| `pnpm typecheck`    | Run TypeScript type checking          |
| `pnpm lint`         | Run ESLint                            |
| `pnpm lint:fix`     | Run ESLint with auto-fix              |
| `pnpm format`       | Format code with Prettier             |
| `pnpm format:check` | Check code formatting                 |
| `pnpm clean`        | Remove build artifacts                |
| `pnpm graph`        | View Nx dependency graph              |

### Project Structure

```
apps/
  web/          # Vite + React 19 SPA
  server/       # Node + Express + Socket.IO
packages/
  shared/       # Shared types and utilities
```

### Tech Stack

- **Frontend**: React 19, React Router 7, Tailwind CSS 4, react-dnd
- **Backend**: Node.js, Express, Socket.IO 4
- **Build**: Vite 8 (web), esbuild/tsx (server)
- **Tooling**: TypeScript 5.9, ESLint 9, Prettier 3, Nx

## Production

`pnpm build` creates `dist/apps/web` and the self-contained Node entrypoint
`dist/apps/server/main.js`. The Heroku-compatible process is:

```bash
NODE_ENV=production \
SESSION_COOKIE_SECRET=<at-least-32-character-secret> \
GAME_STORE=redis \
REDIS_URL=<redis-or-rediss-url> \
node dist/apps/server/main.js
```

Production requires an explicit store and refuses weak cookie secrets. The file store is intended for
local use; an intentional single-process production run must set both `GAME_STORE=file` and
`ALLOW_FILE_GAME_STORE=true`.

## VS Code

This project works great with VS Code. The TypeScript integration is automatic.

For the best experience, install recommended extensions when prompted.
