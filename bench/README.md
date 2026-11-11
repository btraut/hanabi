# Hanabi Bench

Local, headless Hanabi games, fixed-configuration benchmarks, and experiments that evolve shared conventions after every game. The website, database, Redis, and API keys are not required.

Run commands from the repository root after `pnpm install`. Model-backed runs require a file-backed Codex login. The harness finds `codex` on `PATH`, then checks the macOS ChatGPT app bundle in `/Applications` and `~/Applications`. Set `HANABI_CODEX_PATH` to select an executable explicitly; an invalid override fails without falling back. A saved app login works without installing a separate CLI. For a CLI installation, use `codex login`. The local adapter was verified with Codex CLI `0.166.0-alpha.6` and `0.167.0-alpha.3.2`; it requires `exec --ignore-user-config`, structured output, and `debug models --bundled`. Unsupported CLI versions or model IDs fail explicitly.

## Run one game and revise conventions

```sh
hanabi-bench climb --games=1
```

This uses three local-Codex Sol/high players, plays one base game, and then asks the Dreamer to update the shared conventions. Each run writes a new directory under `.context/hanabi-bench/` in the current directory and prints its path. The revised document is saved in `versions/`; the explanation is in `iterations/0000/explanation.md`. If the Dreamer chooses no change, the existing version remains active. The starter conventions file is never overwritten.

Continue that same convention lineage with `hanabi-bench climb --resume PATH --games=1`. Running without `--resume` starts a fresh lineage. Always pass `--games=1` for a single-game test; the default is fifty.

The executable lives at `scripts/hanabi-bench.mjs`. After installing dependencies, add a shortcut from the repository root (with `~/.local/bin` on your `PATH`):

```sh
mkdir -p "$HOME/.local/bin"
ln -s "$PWD/scripts/hanabi-bench.mjs" "$HOME/.local/bin/hanabi-bench"
```

The shortcut uses this checkout's dependencies while resolving output and config paths from your working directory. `pnpm bench climb --games=1` also works from the repository root without installing a shortcut.

## Play and inspect the rules

```sh
pnpm bench play --players 3 --rules 5-color --seed example
pnpm bench rules --players 3 --rules rainbow-black-powder
pnpm bench play --json --seed example
```

Human play accepts a listed action ID, `play card-1`, `discard card-1`, or `clue player-2 blue` (a number also works). Type `quit` to stop. JSON play accepts one object per line, such as `{"playerId":"player-1","actionId":"action-0"}`, and emits rules, observations, errors, and completion as JSON lines. Use `pnpm --silent bench ...` to suppress pnpm's script banner when piping output. The operator controls every seat; each displayed observation is restricted to the current player's view. Model runs isolate each seat's inputs separately.

Hands remain in acquisition order, oldest to newest. Cards cannot be rearranged, and observations contain no positions or layouts. Playing or discarding removes that card without changing the remaining order; replacement cards are appended on the right.

All five game variants and two through five players are supported. The benchmark defaults to three-player `5-color`, with fixed seat order and immediate game over when a critical card is discarded or misplayed. `play` and `rules` use this ending by default and also accept `--critical-game-over` for compatibility. Rule text describes exact engine behavior, including scoring after lost lives and Black Powder penalties. Private logs do not create an in-game communication channel.

## Run one model game

```sh
pnpm bench run --config bench/configs/sol-high.json --seed example --out .context/hanabi-bench/my-game
pnpm bench replay .context/hanabi-bench/my-game/transcript.json
```

Each seat uses local Codex, `gpt-6.1-sol`, high effort. Codex uses your saved login through a temporary isolated home; the harness does not copy or print credentials. Credential refreshes share the original login home's write lock. User/project instructions, memories, skills, plugins, MCP, and coding tools are excluded. Each request replays only that seat's explicit conversation. No Codex session persists across calls. The adapter rejects detected tool activity rather than accepting an assisted result.

Every turn produces a private explanation, followed by a separate reflection call before the next player's turn. No brevity constraint is imposed. Own cards remain hidden even at the terminal reflection. Player input includes the visible board, literal clue marks, intervening events, and legal actions; it contains no computed card possibilities, seed, or undealt deck.

`config.json`, `rules.md`, `conventions.md`, `transcript.json`, `result.json`, and `private/` preserve the exact inputs, outputs, private logs, timing, and available token usage. Full transcripts and private logs are privileged experiment artifacts, never player inputs. Output directories must be new. Defaults use unique directories under ignored `.context/hanabi-bench/`.

Use `bench/configs/scripted.json` for offline checks. Its deliberately weak deterministic policy discards or gives clues, and its Dreamer makes no changes. It tests the plumbing, not model ability; it is never substituted after a Codex failure.

## Review games and hill climbs

```sh
hanabi-bench review .context/hanabi-bench/my-game
hanabi-bench review .context/hanabi-bench/first-climb --no-open --port 4310
hanabi-bench climb --config bench/configs/sol-high.json --games 1 --watch
```

`review` opens an existing game, hill-climb, or evaluation directory in a local, read-only viewer. Browse turns alongside the acting player's explanation and post-action reflection; turn decisions describe the board before the action, while reflections describe its result. Hill-climb review includes iteration results, convention versions, and Dreamer explanations. These are private experiment artifacts, including hidden cards and private logs, not player inputs.

Add `--watch` to `run` or `climb` to open the viewer while artifacts are written. It also works with `climb --resume DIR`. The result still prints when the run finishes, and the viewer stays open until Ctrl+C. Interrupting an active watched run aborts model work and closes the viewer. `review` never starts games or model calls. `--no-open` suppresses automatic browser opening, and `--port N` selects a port; both require `--watch` on run/climb. The server listens only on loopback and exposes no game controls. The isolated viewer frontend is built locally when the server starts.

## Compare fixed configurations

```sh
pnpm bench eval --config bench/configs/sol-high.json --config bench/configs/sol-high-rules-only.json --games 2 --seed comparison --out .context/hanabi-bench/comparison
```

`--games` is the number of deals **per configuration**. Configurations receive matched seed sequences. Each game has fresh player conversations and fixed conventions. The report shows perfect-game rate, average completed-game score, execution failures, timing, and reported token usage. Perfect-game rate counts failed executions as non-perfect attempts; a separate completed-game rate makes that distinction explicit. The 95% Wilson interval describes sampling uncertainty, not a guarantee. Compare configurations with the same rules and player count; scores across different variants are not directly comparable. Local subscription inference does not provide a dollar cost, so none is invented.

## Evolve conventions

```sh
# Small end-to-end check:
pnpm bench climb --config bench/configs/sol-high.json --games 1 --out .context/hanabi-bench/first-climb

# Manually continue the same configuration and convention lineage:
pnpm bench climb --resume .context/hanabi-bench/first-climb --games 1
```

The normal trial length is fifty games (`climb` defaults to 50); use `--games 1` for a smoke run. No run starts automatically. Every iteration plays a fresh seeded deal with fresh players, then asks the Dreamer to inspect the full game history and private logs. The Dreamer can freely rewrite the single convention document or leave it unchanged. It must explain its decision separately. Revised conventions apply immediately to the next game; there is no adoption-test batch. Fixed rules remain outside the editable document and are enforced by the engine.

`state.json` records configuration, seed sequence, iterations, immutable convention versions, parent versions, and explanations. `versions/` contains the corresponding Markdown documents. Each iteration has its own game artifacts, Dreamer input/output, `revision.json`, and a readable `explanation.md`. Failed attempts remain in history. A model or validation failure stops the run and preserves evidence; manual resume continues with a new deal and the last committed convention version. A process interrupted before its iteration checkpoint is marked failed on resume, retaining its partial artifacts. Resume adds the requested number of games and does not overwrite completed ones. Concurrent writers to one lineage are rejected. Locks are never reclaimed automatically: after an abrupt process exit, verify the process recorded in `.running` has stopped on its recorded host, then manually remove that file before resuming. Resume recovers a durable game result if available and counts interrupted attempts without results as failures without inventing scores or usage. The atomic `state.json` manifest is authoritative; missing derived reports and convention files are regenerated, while modified convention files are rejected.

The evolving run's aggregate score is descriptive, not evidence that every revision helped. Benchmark a selected version separately by referencing its Markdown file as `conventionsFile` in a fixed configuration.

## Configuration

Start with the JSON examples in `configs/`. Each of two through five `players` has `provider`, `model`, `effort`, optional integer `timeoutMs` from 1 through 2,147,483,647 milliseconds (default 300,000), and optional `options`. Supported providers are `codex` and the offline `scripted` fixture. The provider interface permits additional adapters; no Opus/API adapter is included. Requested effort is validated against the installed model catalog before inference. Sol does not support `none` or `minimal`. Tool-free Codex rejects `ultra` because it requires delegation; `high` remains the default. Model availability also depends on the account.

`options` supports `modelVerbosity` (`low`, `medium`, `high`) and `serviceTier` (`default`, `priority`, `flex`), subject to Codex/model support. Unknown fields are rejected. `game.ruleSet` selects the variant; `game.criticalGameOver` defaults to `true`; set it to `false` only for an explicit comparison without critical-card early ending. Saved runs retain their stored rules. `game.allowDragging` may be omitted or set to `false`; movement-enabled configurations and version 2 movement transcripts are unsupported. `conventionsFile` resolves relative to the config file; alternatively use inline `conventions`. Set `conventions` to `null` or `""` for rules-only play. Omission uses the minimal starter conventions. Do not supply both convention fields.

`dreamer` has its own model configuration. `discussion` defaults to false. When enabled, each player first debriefs independently with its own hidden cards still concealed, then participants discuss the full transcript and collected debriefs. The Dreamer receives the discussion as additional evidence. Player memory never carries into another game; the Dreamer is supplied the entire experiment history explicitly. History is not silently truncated; a model context-limit error stops the run with artifacts intact.

## Verification

```sh
pnpm test apps/server/src/bench
pnpm typecheck
pnpm lint
```

The engine tests compare headless transitions with the actual production server across all variants, seat counts, and early-ending settings. Additional tests cover private information boundaries, local subprocess isolation, model failures, matched-seed evaluation, immediate convention propagation, manual continuation, and CLI replay.
