---
date: 2026-09-03
topic: admin-round-ledger
---

# Admin Round Ledger

## Problem Frame

Hanabi records round transcripts, but there is no quick way for the operator to see whether people are using the game, who is playing, or how rounds generally end. Add a deliberately small, unlisted dashboard that turns existing transcript data into a readable activity ledger.

---

## Key Flows

- F1. Unlock the ledger
  - **Trigger:** The operator visits `/admin` directly.
  - **Steps:** The page shows only a password form. A correct password unlocks the ledger for the browser session; a wrong password leaves all telemetry hidden and shows a concise error.
  - **Outcome:** Casual discovery does not expose player names or game results.
  - **Covered by:** R1, R2, R3
- F2. Review game activity
  - **Trigger:** The authenticated operator opens or pages through the ledger.
  - **Steps:** The newest rounds appear first with player names, start time, turn count, lifecycle state, and final result when available. Pagination moves through older rounds without loading the entire history.
  - **Outcome:** The operator can quickly judge usage and outcomes.
  - **Covered by:** R4, R5, R6, R7

---

## Requirements

**Access**

- R1. The dashboard is available only at the direct `/admin` route and is not linked from the game UI.
- R2. Before authentication, the page displays only a single password field and submit control.
- R3. The default password is `tenfour`; it can be replaced through deployment configuration without changing code. Authorization is enforced by the server, not by hiding data in the client.

**Round ledger**

- R4. Authenticated visitors see transcript-backed rounds ordered newest first.
- R5. Every row shows the player names, when the round started, accepted turn count, current lifecycle state, and transcript integrity.
- R6. Finished rows show the final score and a human-readable result. Reset and in-progress rounds are labeled honestly rather than presented as completed games.
- R7. The ledger uses fixed-size pages and provides previous/next navigation plus the total round count.

**Behavior**

- R8. Loading, empty, authentication-failure, and database-failure states are understandable without exposing credentials, transcript payloads, or database details.
- R9. The page works at phone and desktop widths and remains visually distinct from the playable game while using the established Hanabi palette and typography.

---

## Acceptance Examples

- AE1. **Covers R2, R3.** Given a visitor without an authorized admin session, when they request the game list or submit a wrong password, no transcript summaries are returned.
- AE2. **Covers R4, R5, R6.** Given a finished transcript for Alice and Bob with 18 moves and score 12, the ledger shows Alice, Bob, 18 turns, score 12, and the human-readable finish reason.
- AE3. **Covers R6.** Given a reset round without a final result, the ledger shows `Reset` and no invented score.
- AE4. **Covers R7.** Given more rounds than fit on one page, the first page contains the newest fixed-size slice and Next loads the following slice.

---

## Success Criteria

- A direct visit gives the operator a fast answer to how many rounds exist, who played them, how long they lasted, and how they ended.
- Unauthenticated requests cannot retrieve the telemetry payload.
- The implementation adds no accounts, roles, admin navigation, analytics platform, or normalized reporting schema.

---

## Scope Boundaries

- No user accounts, password reset, role management, external identity provider, or claim of strong security.
- No charts, filters, search, CSV export, transcript replay, transcript editing, or game deletion.
- No links to the dashboard from public Hanabi screens.
- No storage changes beyond the existing transcript records.

---

## Key Decisions

- Use the simple password `tenfour` by default because the goal is a speed bump against casual discovery, not protection for sensitive records.
- Show all started rounds, including reset and in-progress rounds, because they are useful evidence of real usage.
- Use a compact chronological ledger rather than an analytics dashboard; the data volume and question do not justify more machinery.

---

## Dependencies / Assumptions

- Game transcript persistence and PostgreSQL are available when the dashboard is deployed.
- Player-entered names may be informal or duplicated and are displayed exactly as recorded.

---

## Next Steps

✅ Implemented the password gate, paginated transcript-summary API, unlisted responsive page, and focused integration tests on the existing transcript-persistence branch. Verified the complete flow in Chrome at desktop and phone widths against local PostgreSQL.
