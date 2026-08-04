# Production deployment

Hanabi production runs on Railway at `https://hanabi.btraut.com`.

Railway watches the GitHub `production` branch. Pushing or merging to `main` does not deploy the application. A release is an explicit fast-forward promotion of the tested `main` commit to `production`:

```bash
git fetch origin
git switch production
git merge --ff-only origin/main
git push origin production
```

Before promoting, run the repository verification gates from `main`:

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Railway builds the pnpm/Nx workspace from the repository root, starts `dist/apps/server/main.js`, and checks `/api/readyz` before routing traffic to a new deployment. The service runs exactly one application replica with no deployment overlap because Socket.IO connections and active game state are process-local. Runtime secrets and the Redis connection remain Railway environment variables and must not be committed.
