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

3. Start PostgreSQL and apply the checked-in schema:

   ```bash
   pnpm db:up
   pnpm db:migrate
   ```

   Transcript persistence is optional when `DATABASE_URL` is absent outside production. The
   example environment points at the local Compose service.

### Development

Start both web and server in development mode:

```bash
pnpm dev
```

This assigns deterministic, collision-safe ports from the Git worktree path, starts both services,
and writes the authoritative URLs to `.context/dev/current.json`. Different worktrees can run at the
same time without fighting over ports. Use `pnpm dev:status` to print the current URLs and
`pnpm dev:down` to stop the launcher.

#### Single-browser debug player

Press **Option-D** anywhere on the page to toggle the development-only **Debug Player Controls**
panel. `?debug=1` remains available for opening it directly. After joining as the host, use the panel
to add a second player. During that player's turns, the panel can play or discard any card and give
valid color or number clues, so the full turn loop works in one browser. The development launcher
enables the matching server controls; production rejects them.

#### Game archive

Visit `/admin` directly to see the unlinked, read-only game archive. It lists the newest transcript
rounds first with player names, turn count, score, and result, 25 at a time. The default dashboard
password is `tenfour`; set `ADMIN_PASSWORD` to override it. Successful sign-in creates a signed,
HTTP-only browser-session cookie and the password is never stored by the web client.

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
| `pnpm db:up`        | Start local PostgreSQL                |
| `pnpm db:migrate`   | Apply checked-in database migrations  |
| `pnpm db:generate`  | Generate migration SQL from Drizzle   |
| `pnpm db:down`      | Stop local PostgreSQL                 |

### Continuous integration

GitHub Actions runs the **Build and test** check on every pull request to `main` and every push to
`main`. It installs the locked dependencies, checks TypeScript, runs the test suite, and builds both
apps. A temporary PostgreSQL 17 service runs the database integration test without production secrets.
Node and pnpm versions come from `.tool-versions` and `package.json`.

The `main` branch requires pull requests with a passing **Build and test** check against the latest
base branch before merging, including for administrators. No human review approval is required.
These merge requirements are configured in GitHub branch protection, separately from the workflow.

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
ADMIN_PASSWORD=<dashboard-password> \
GAME_STORE=redis \
REDIS_URL=<redis-or-rediss-url> \
DATABASE_URL=<postgres-or-postgresql-url> \
node dist/apps/server/main.js
```

Production requires Redis/file active-game storage, PostgreSQL transcript storage, and a strong cookie secret. The file store is intended for
local use; an intentional single-process production run must set both `GAME_STORE=file` and
`ALLOW_FILE_GAME_STORE=true`.

## VS Code

This project works great with VS Code. The TypeScript integration is automatic.

For the best experience, install recommended extensions when prompted.
