# Bot conversation cache benchmark

The persistent-conversation provider without scratchpad notes hit the OpenAI prompt cache on all three continuation turns. The comparison below uses eight real Responses API requests on September 6, 2026: four preserved measurements from the original stateless provider and four fresh measurements after scratchpad removal. The controlled benchmark used medium reasoning to match the original baseline; the shipping default is high effort. Every measured request used `gpt-5.6-sol`, medium reasoning, and a 4,096-token output limit, completed successfully, and passed provider decision validation.

| Turn | Before input / cached tokens | After input / cached tokens | Before request bytes | After request bytes |
| ---- | ---------------------------: | --------------------------: | -------------------: | ------------------: |
| 1    |                   12,092 / 0 |                  11,833 / 0 |               57,240 |              56,163 |
| 2    |                   12,664 / 0 |             17,104 / 11,830 |               59,269 |              23,036 |
| 3    |                   13,507 / 0 |             22,201 / 17,101 |               62,520 |              21,714 |
| 4    |                   14,392 / 0 |             27,253 / 22,198 |               65,968 |              20,997 |

Total uncached input fell from **52,655 to 27,262 tokens (48.2%)**. Total request bytes fell **50.2%**, or **65.0%** when comparing only continuation requests. The API served **51,129 cached tokens** across those continuations, comprising 76.8% of their input. Total observed request latency was 26.25 seconds before and 18.14 seconds after; this small sample does not establish a general latency improvement.

Full logical input grew from 52,655 to 78,391 tokens because the retained conversation includes earlier observations and model responses. Conversation storage does not make historical input free: cached tokens remain API input, and context grows with the round. See the official [conversation-state](https://developers.openai.com/api/docs/guides/conversation-state) and [prompt-caching](https://developers.openai.com/api/docs/guides/prompt-caching) documentation. These figures measure token reuse and request size, not a dollar-cost guarantee or full-game scaling.

The benchmark used four deterministic local Hanabi observations with five-card hands, bot discards and replacement draws, interleaved teammate number clues, and accumulating public history. Each opportunity supplied one legal scripted discard to keep the before/after state identical. Model arrangements were not applied to the fixed fixture. This isolates request transport and caching; it does not measure playing strength or replace runtime integration tests. No live game was modified.

The baseline executed the original provider and policy from commit `eb13670c60d2ecfc3eb5c97256d7c9687f74cce3`, including complete instructions, history, and accumulated private notes on each request. Its structured-output schema changed each turn with card IDs. The current implementation sends the initial developer preamble once, reuses the preceding accepted response ID, sends incremental history, and retains a stable three-field schema containing `actionId`, `arrangement`, and `explanation`. It neither requests scratchpad notes nor supplies a private journal, including during initialization or recovery. Earlier explanations remain in the provider-managed conversation as model responses. The size comparison includes both conversation reuse and removal of the scratchpad contract; it does not isolate their individual effects.

Automated assertions verified identical observation hashes, correct response chaining, cache hits, stable schema hashes, absence of repeated developer messages and instructions on continuations, and absence of scratchpad fields from all four after requests. The provider validated every returned decision against its three-field response contract.

[Raw measurements](./bot-cache-benchmark.json) include response IDs, preceding response IDs, source hashes, token counts, cache-write counts, request bytes, and latencies. Counters were read directly from `usage.input_tokens_details`; no cache values were inferred. A missing API field is recorded as `null`. The original before measurements are preserved unchanged. The initial four-request conversation experiment that still supported scratchpad notes is retained separately under `historicalConversationWithScratchpadRun` and is excluded from this comparison.

To repeat this paid benchmark from the repository root with `OPENAI_API_KEY` set:

```sh
pnpm exec tsx --tsconfig tsconfig.base.json scripts/benchmark-bot-cache.ts before
pnpm exec tsx --tsconfig tsconfig.base.json scripts/benchmark-bot-cache.ts after
```

Each command makes four paid requests and writes redacted measurements to `.context/bot-cache/before.json` or `.context/bot-cache/after.json`. The before command loads the original provider, policy, journal helper, and conventions from the recorded Git commit; `BOT_CACHE_BASELINE_REF` can select another commit. Legacy journal code exists only in the historical benchmark fixture. The after command uses the current runtime and does not create a journal. The tracked report is not overwritten by later benchmark commands.
