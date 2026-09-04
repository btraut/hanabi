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

The application service runs exactly one replica with no deployment overlap because Socket.IO connections and active game state are process-local. Runtime secrets plus Redis and Postgres connection references remain Railway environment variables and must not be committed. Transcript rows contain player-entered names, so application logs must include only game/round/action identifiers and sanitized database error codes—never transcript payloads or names. Operators can delete old telemetry directly from `game_transcripts` by `started_at`; automatic retention is intentionally not part of transcript v1.
