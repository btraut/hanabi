# Dependency audit

Checked 2026-07-18 with `pnpm outdated -r` and `pnpm audit` on Node 24.11.1.

## Updated or removed

- React 19.2, React Router 7.18, Vite 8.1, Tailwind 4.3, Vitest 4.1, and boring-avatars 2.0 are on current compatible releases.
- `uuid` was replaced by platform `crypto.randomUUID()` in Node and the browser.
- `store` was replaced by native `localStorage`, removing its direct-`eval` production warning.
- `tailbreak`, `method-override`, legacy PostCSS packages, and their type packages were removed as unused or obsolete.
- Current compatible releases of Prettier 3, tsx 4, typescript-eslint 8, eslint-config-prettier 10, react-hooks lint rules 7, Morgan 1, and dotenv 17 were installed.
- Compatible patch releases for Socket.IO parser, `ws`, Express's `path-to-regexp`, Nx's `minimatch`, and tooling's `picomatch` remove the known audit findings. `pnpm audit` reports no known vulnerabilities.

## Intentional major-version holds

- Nx 20 and `@nx/eslint` 20: Nx 23 is a separate workspace migration and does not affect the shipped runtime.
- ESLint 9 and `@eslint/js` 9: ESLint 10 should move with Nx rather than splitting the toolchain compatibility set.
- TypeScript 5.9: TypeScript 7 should move with Nx and a dedicated compiler migration.
- Express 4: Express 5 changes wildcard routing and middleware typings; the production artifact is covered on Express 4.
- Redis 4: Redis 6 is an API and persisted-production-path migration that requires a live Redis integration environment.
- React Router 7: `react-router-dom` remains on 7, so the core package cannot move alone to React Router 8.
- `@types/node` 24: types intentionally match the Node 24 runtime instead of the newer Node 26 type surface.

## Quality-debt guardrail

Type-aware ESLint still reports 55 web warnings and 10 server warnings in legacy code. Promise-safety rules are errors, and each Nx lint target caps the remaining warning count at its current baseline so new warnings fail CI instead of silently expanding the debt.
