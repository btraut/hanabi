# Agent Guide

## Repo snapshot

- Hanabi is an online games platform with a React SPA and a Node/Express server that uses websockets for real-time gameplay.
- The project is being modernized to a pnpm + Nx monorepo with Vite for web and a Node server app; see the modernization spec for details. (Note to agents: update this section when migration is complete)
- Runtime/tooling target: Node v24.11.1 with mise/direnv.

## Tooling expectations

- Use mise with `.tool-versions`; load via direnv when present (`mise install`, then `direnv allow`).
- Run commands from repo root `/Users/btraut/Development/hanabi`.
- Use the repo's package manager and scripts; once modernization lands, prefer `pnpm`.

## Coding guardrails

- Preserve runtime behavior; avoid changing gameplay logic unless explicitly requested.
- Be cautious with websocket changes; keep long-lived connection semantics intact.
- Keep secrets in `.env` and never commit them.
- Prefer small, focused changes and avoid unnecessary abstractions.

## Committing

- If asked to commit and push, use the current branch and push to origin.
- If asked to "ship it", it means: commit on the current branch, rebase that branch onto the local `production` branch, then fast-forward `production` to the current branch so production includes the new commits, and push BOTH branches to origin.

## Work checkpoints (run after a logical chunk)

- If available, run lint/typecheck/format from repo root and report results.
- Update README/specs/AGENTS if behavior or interfaces change.

## Working from specs

- When executing a spec, after finishing a step, mark it in the spec with a green check mark emoji (✅) and add any implementation notes beside the step.
