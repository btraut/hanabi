# Hanabi

An online multiplayer Hanabi game.

The Activity feed combines moves and chat in chronological order, with compact game events and
distinct chat bubbles. Clues name the hinted color or number and the number of affected tiles.
The feed scrolls within the available window height and follows new activity while pinned to the
bottom; scrolling up preserves your reading position. On phones, Activity opens in a drawer.

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

Codex workspace setup copies `.env` and `apps/server/.env` from the primary Git checkout before
installing dependencies. Existing worktree files are preserved, and missing source files are skipped.
Run `node scripts/setup-worktree.mjs` to copy these files into an existing worktree.

Start both web and server in development mode:

```bash
pnpm dev
```

This assigns deterministic, collision-safe ports from the Git worktree path, starts both services,
and writes the authoritative URLs to `.context/dev/current.json`. Different worktrees can run at the
same time without fighting over ports. Running `pnpm dev` again in the same worktree prints the
existing runtime's status and web/server URLs, then exits successfully without starting another
instance. If the first launcher is still assigning ports, it reports startup in progress.
Use `pnpm dev:status` to print the current URLs and
`pnpm dev:down` to stop the launcher.

#### Client state and animations

`HanabiGameStore` receives complete socket snapshots and publishes separate board,
activity, and bot-status channels. Equal JSON branches retain their identity;
React subscriptions use `useSyncExternalStore`. The session context contains the
store and commands, so chat updates do not invalidate the board's context.

`HanabiBoardPresentation` owns the card animation coordinator and the displayed
board snapshot. Tile rendering, drag positions, and gameplay effects subscribe to
that presentation. Chat and bot indicators subscribe to authoritative state and
update during animation capture or playback. Gameplay tracking uses action IDs
and its own bounded history, so chat retention cannot trigger an animation or
hide a newly played card. Review and static fixtures use independent snapshots.

#### Single-browser debug player

Press **Option-D** anywhere on the page to toggle the development-only **Debug Player Controls**
panel. `?debug=1` remains available for opening it directly. After joining as the host, use the panel
to add a second player. During that player's turns, the panel can play or discard any card and give
valid color or number clues, so the full turn loop works in one browser. The development launcher
enables the matching server controls; production rejects them.

#### Server-run bots

Set `HANABI_BOTS_ENABLED=true` and `OPENAI_API_KEY` in the ignored `apps/server/.env`, then
restart the server. Join a lobby as its creator and click **Add bot**. Bots occupy normal seats
within the five-player limit; at least one human must join before starting. The creator can
remove bots before the game starts. API calls run on the server and continue if the browser closes.
New bots receive a random robot name from `bots/BotNames.ts`, excluding names already used by
any player in that lobby. Existing bots keep their names across reloads and game resets.

Edit [conventions.md](apps/server/src/games/hanabi/bots/conventions.md) to coach the bot. New rounds
compose this Markdown with the active mode's rules and enabled options: five colors, six colors,
Rainbow, Black Powder, or Rainbow plus Black Powder. Restart development or rebuild/redeploy
production, then start a new round to adopt edits. Each round snapshots its prompt, rules, coaching,
model, effort, and communication contract. The defaults are `gpt-6-astra` and `high`; override them
with `HANABI_BOT_MODEL` and `HANABI_BOT_REASONING_EFFORT`.

Every request contains the bot's permitted view: visible teammate cards, resources, fireworks,
discards, every player's upper-row order and lower-area placements, and the complete recorded
history of clues, plays, discards, draws, and committed arrangements. Stable card IDs carry positive
and negative clue evidence, source events, and possible identities. Replacement draws start with
fresh knowledge. Clue events preserve their original board and layout context. The bot's own faces,
undealt cards, and shuffle seed are excluded. Requests have no tools or shared conversation.

Literal knowledge is separate from convention interpretation. A teammate's visible face does not
become that teammate's clue knowledge. Own-card `observerPossibleIdentities` can additionally account
for copies visible in other hands. Conventions such as a single-card clue usually suggesting a play
remain conditional; missed clues never create hard identity exclusions.

New rounds also give each bot a private notepad, persisted for that seat and round. Every accepted
decision explanation is appended automatically; the bot may return an additional `notes` string of
up to 8,000 characters, or `null` for no extra note. The full notepad accompanies every request to
that bot. Use it for concise hypotheses, corrections, reminders, and source-event references;
its contents are revisable model beliefs, not factual clue evidence. The journal and extra notes
are excluded from other bots' requests, public game state, and transcripts. The decision explanation
also appears in public debug chat.

A bot makes decisions on its own turn, immediately after receiving a clue when dragging is enabled,
and after its own play or discard. On its turn, it returns one supplied action ID, a nullable full-hand arrangement,
and a brief explanation, with optional extra notes. An off-turn clue opportunity permits an optional
arrangement, explanation, and notes; its action ID is null. If the clue makes it the next player, one request combines the
arrangement and turn action. Arrangement consumes no turn. Setting touched cards aside is coaching,
not an automatic move: the bot may keep them in place, move them below, or reorder its discard queue.
After a play or discard, the bot receives the revealed result and its updated hand, including any
replacement card without that card's face. It can briefly interpret the result, update its notepad,
and optionally rearrange; its action ID is null. This review runs in the background without a status
pill, allowing the next human or bot to take their turn while it finishes. A bot completes its own
pending review before responding to another clue or taking its next turn. This follow-up also runs when dragging is disabled,
with no arrangement, and after an action ends the game, with notes only. Protected cards remain
conceptually reserved when dragging is disabled. Humans retain ordinary off-turn dragging.

The server validates the entire decision before applying it, then posts its explanation as a chat
message from the bot, prefixed with `Debug: `. Every accepted turn, clue response, or result reflection produces one
message, including a response that keeps the layout unchanged. The complete explanation can
contain up to 1,000 characters plus the prefix; ordinary player messages retain their 500-character
limit. Debug messages are visible to every player and watcher and may reveal teammate cards their
owners cannot see. They are persisted with chat, consume no turn, and are excluded from bot
observations, factual history, and gameplay transcripts. Explanations are not written to the server
console. Rejected or stale decisions produce no debug message.
Existing v1 rounds keep their saved prompt and action-only contract. Existing v2 rounds without
`notepadVersion` retain their three-field decision contract; new rounds enable the private notepad.
Saved policies without `reflectionAfterAction` retain their original decision opportunities.
Old saves without layout history are marked incomplete rather than
assigned invented events.

A failed request pauses that bot decision opportunity and shows **Retry** when another attempt is
allowed. Seated humans can retry; the bot never makes an arbitrary fallback move. A failed optional
clue response is skipped if it would block a different bot's normal turn, leaving the cards unchanged. The default
deadline is 120 seconds with at most one automatic retry for transient API failures. Each response
allows up to 16,384 output tokens, including internal reasoning and the final decision. Turn and clue opportunities share these limits. The server
allows three concurrent requests; other turn and clue requests wait for capacity automatically.
There are no cumulative request or token budgets, either per game or across the server. Saved games
stopped by a retired budget resume automatically. The environment examples list configurable request limits.

Result reflections use low reasoning effort, at most 2,048 output tokens, and a five-second deadline per attempt.
They receive one attempt and are skipped on failure or timeout so the next turn can continue.
The revealed action remains in the complete history for interpretation on a later turn. These
requests share the concurrency limit; they never replay the completed action.

V2 requests include the complete history and enabled private notepad within a 512,000-byte combined
input limit. Oversized requests pause inference without truncating saved events or notes, or blocking
human movement.

Round usage counters and recovery state use existing active-game persistence. There is no per-round
attempt or token cap. Games saved at the retired round limit can continue using **Retry**. Global limits reset with
the process. A crash can lose the latest unflushed save, so persistence does not guarantee
exactly-once API billing. Disabled or unconfigured bots do not prevent human-only games.

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

### Restart and reconnect

Active games are saved in the configured game store and restored before the server accepts
connections. A returning browser can refresh the same game URL to recover the saved round;
an open game also reconnects automatically. PostgreSQL transcripts support game review and
are separate from the Redis/file snapshots used to resume active games.

The signed, HTTP-only `SESSION` cookie identifies the player for one year. Preserve
`SESSION_COOKIE_SECRET` across deployments so the same browser retains its seat and creator
permissions. The game code allows finding and watching a game, but does not grant another
player's identity. A new browser, cleared cookies, or an invalid cookie receives a new identity.

Graceful shutdown flushes pending game saves. An abrupt process crash can lose changes whose
asynchronous save has not finished. Keep Redis data or the file-store directory durable across
restarts. Games with no recorded activity for 24 hours are pruned, including during startup;
reconnecting does not restore a pruned game from its transcript.

## VS Code

This project works great with VS Code. The TypeScript integration is automatic.

For the best experience, install recommended extensions when prompted.
