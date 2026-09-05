# Production deployment

Hanabi production runs on Railway at `https://hanabi.btraut.com`.

Railway watches the GitHub `main` branch. Every push or merge to `main` automatically deploys the application.

```bash
git switch main
git pull --ff-only origin main
pnpm test
pnpm lint
pnpm typecheck
pnpm build
git push origin main
```

Railway builds the pnpm/Nx workspace from the repository root, runs `dist/apps/server/migrate.js` as a pre-deploy command, starts `dist/apps/server/main.js`, and checks `/api/readyz` before routing traffic to a new deployment. A failed migration blocks the release before new application code starts.

The project includes a managed Postgres service named `Postgres`. The application service defines `DATABASE_URL` as the reference variable `${{Postgres.DATABASE_URL}}`, keeping credentials synchronized and off disk. Postgres stays on Railway's private network; no public TCP endpoint is required.

The unlinked `/admin` route exposes a read-only, paginated game archive. Set `ADMIN_PASSWORD` on the application service to override the deliberately simple `tenfour` default. Authentication is enforced by the server and stored in a signed, HTTP-only browser-session cookie; the route is a lightweight telemetry speed bump, not an account or role system.

The application service runs exactly one replica with no deployment overlap because Socket.IO connections and active game state are process-local. Runtime secrets plus Redis and Postgres connection references remain Railway environment variables and must not be committed. Transcript rows contain player-entered names, so transcript persistence logs must include only game/round/action identifiers and sanitized database error codes—never transcript payloads or names. Operators can delete old telemetry directly from `game_transcripts` by `started_at`; automatic retention is intentionally not part of transcript v1.

## Bot configuration

Bots require `OPENAI_API_KEY` and `HANABI_BOTS_ENABLED=true` on the `hanabi` application service.
The key is a server runtime variable, never a `VITE_` variable. The POC reuses only
`OPENAI_API_KEY` from Doppler project `manavault`, config `dev_api`; this shares that OpenAI
project's quotas and billing. Local development stores it in ignored `apps/server/.env` with
mode `600`. No Doppler token or other ManaVault secret is required by Hanabi.

To rotate, retrieve that single key through a non-echoing process and pipe it to Railway's
`variable set OPENAI_API_KEY --stdin`, with the explicit Hanabi service and production environment.
Use `--skip-deploys` when staging for a planned release. Never pass the value in command arguments,
print it, or export a full Doppler environment. Railway runtime variables provide the server's
secret storage; the POC key is a standard variable, not a sealed variable.

Before enabling bots, confirm the one-replica/no-overlap deployment configuration, run the
repository checks, and deploy with the intended feature flag. Verify `/api/readyz`, then exercise
both a normal bot turn and an off-turn clue response. Confirm layouts survive reconnect and that
an off-turn arrangement consumes no turn. A clue making the recipient the next player uses one
combined request. Arrangements are optional model choices; the server does not force touched
cards into the lower area. Humans retain off-turn dragging when enabled.

Editing `apps/server/src/games/hanabi/bots/conventions.md` requires rebuilding and deploying.
New rounds compose the active mode/options with the coaching and snapshot the effective policy.
Existing rounds retain their saved version: v1 remains action-only; v2 includes complete recorded
clue/layout history, literal clue knowledge, and optional arrangements. Model interpretations of
conventions are not stored as proven facts. Saved histories without earlier layout events carry
explicit completeness markers.

New rounds snapshot `notepadVersion: 1` and persist a separate private notepad for each bot. Every
accepted decision explanation is retained automatically, plus any optional model-authored `notes`
(up to 8,000 characters per decision). Each request receives that bot's complete notepad for the
round. Entries carry decision IDs and observed/recorded event checkpoints. Treat their text as
revisable model beliefs, never authoritative game facts. The notepad and extra notes stay out of
public snapshots, transcripts, other bots' requests, and operational logs; accepted explanations
also appear in public debug chat. Existing v2 rounds without the flag keep
their original three-field response contract; start a new round to enable the notepad.

`HANABI_BOT_MODEL=gpt-6-astra` and `HANABI_BOT_REASONING_EFFORT=high` are the defaults. The server
environment example controls deadline, concurrency, and budgets. Off-turn clue requests consume
the same inference budget as turn requests. A failed optional clue response is skipped with a
sanitized warning if it would block another bot's own turn; cards stay unchanged. Other failures
remain paused for retry. The rolling global budget is per process and resets
on restart; round reservations and pending decision opportunities use active-game persistence.

Every accepted v2 turn or clue response posts one chat message from the bot after its arrangement
and action are applied, prefixed with `Debug: `. Unchanged clue responses also post their explanation.
The chat action ID matches the notepad decision ID, and the message contains the full explanation
(up to 1,000 characters plus the prefix). Only bot-authored debug messages receive this larger
limit; ordinary player chat remains capped at 500 characters. Debug messages are broadcast to
players and watchers and persisted with ordinary chat. They may mention cards hidden from their
human owners. Chat is excluded from bot observations, factual history, and gameplay transcripts
and does not advance the turn or schedule another bot request. Rejected or stale responses produce
no debug message. Explanations are not logged to the server console. Operational failures use
sanitized codes; logs do not dump prompts, observations, raw provider responses, internal reasoning,
extra notes, or credentials.

Set `HANABI_BOTS_ENABLED=false` and redeploy to stop further bot calls. Existing human-only games
remain available, and saved bot opportunities show disabled status.

POC verification on 2026-09-04: the key was staged and verified on the production application
service with deployment skipped. The production bot flag was left unchanged. The POC has been
exercised locally; its code has not been deployed to production.
