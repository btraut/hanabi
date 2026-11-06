# Editable bot conventions

The Hanabi lobby lets its joined host edit one conventions document shared by every bot.
The section appears only when a bot is seated and reads: “Bots use these instructions to guide
their actions.” Everyone can read the accepted document. The host can edit it and reset custom
instructions to the built-in default. Starting a round freezes its accepted document.

## Implementation and verification

- ✅ Add a host-only, revision-checked save/reset message and persist accepted lobby conventions.
  Reject stale updates, changes after start, oversized input, and saves without a bot. Block start
  while a review is pending; do not apply asynchronous review results after reset or permission changes.
- ✅ Separate conventions from trusted instructions in new rounds. Preserve legacy saved policy
  behavior. Include a strict Hanabi-only scope contract and retain server enforcement of legal actions
  and information visibility. Custom rounds suppress model-generated public explanations.
- ✅ Review custom submissions using a bounded, tool-free model request, failing closed on rejection
  or service errors. Bound submission rates and custom-round request/token usage. These controls
  reduce abuse; semantic review is not a guarantee against prompt injection.
- ✅ Add the lobby editor using existing components and styles. Save explicitly, retain rejected
  drafts, handle revision conflicts, and show Reset only for changed conventions. Display source as
  text so embedded HTML, links, and images cannot execute or fetch content.
- ✅ Verify permission, race, persistence, prompt-role, resource-limit, and UI behavior with targeted
  tests; run the full suite, lint, typecheck, format checks, build, and desktop/mobile browser checks.

## Validation evidence

897 tests pass; one database integration test is skipped without its test database environment.
Lint, typecheck, production builds, and formatting checks for every changed file pass. The
repo-wide format check reports pre-existing formatting in `.beads/metadata.json` and `pnpm-lock.yaml`;
those files are unchanged. Chrome desktop and 390px mobile verification covers bot-only visibility,
editing, save/pending states, rejection recovery, and Reset. Browser model responses are local test
doubles; no live-model injection-resistance claim is made. Code review found and verified the fix
for cross-tab save-response correlation and has no residual actionable findings.

Publishing uses `btraut/editable-bot-conventions`; this task does not merge or deploy.
