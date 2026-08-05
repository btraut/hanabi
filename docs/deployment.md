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

Railway builds the pnpm/Nx workspace from the repository root, starts `dist/apps/server/main.js`, and checks `/api/readyz` before routing traffic to a new deployment. The service runs exactly one application replica with no deployment overlap because Socket.IO connections and active game state are process-local. Runtime secrets and the Redis connection remain Railway environment variables and must not be committed.
