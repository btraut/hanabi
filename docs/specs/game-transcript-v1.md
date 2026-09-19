# Hanabi Game Transcript v1

Hanabi game transcripts are server-recorded replay and telemetry documents. One transcript represents one round, identified by the round seed in `roundId`; resetting a lobby ends the current round and a later start creates another transcript under the same `gameId`.

Complete, finished transcripts are included as `reviewTranscript` in recipient game snapshots for post-game review. In-progress, reset, partial, and conflicted recordings are not exposed for review. The field is not stored in authoritative game state. Replay uses the shared version-1 types and can run without a database; persisted review links and admin entry are separate work.

## Replay semantics

- `players` preserves the player iteration order used when dealing. `dealOrder` records each player's initial hand in the exact order it was dealt.
- `deck` contains every tile exactly once in first-consumed-first order. Its prefix is the full hands in `dealOrder`; its suffix is the remaining draw stack reversed from the runtime's internal array because gameplay draws with `pop()`.
- `turnOrder` is the independently randomized player order. It must not be inferred from `players` or `dealOrder`.
- `moves` contains only accepted play, discard, and clue actions in server order. Chat and hand movements are separate fields; connection changes and rejected requests are excluded.
- Each move contains the source action ID and timestamp, a zero-based index, action-specific input and outcome, and the authoritative post-turn state. A terminal move carries the result both in `postTurn.result` and at the transcript root.
- `revision` starts at 1 for the round-start snapshot and increases for accepted moves, hand movements, chat, and reset finalization. Recorder implementations may use it to reject stale snapshots.

## Chat and analysis exports

The optional `chat` field contains `coverage` (`complete` or `partial`), optional `reason`, and
`messages`. An absent field means chat is unavailable; it does not mean nobody spoke. Replay
`integrity` and chat coverage describe independent histories.

Messages preserve `id`, `createdAt`, `actorId`, `actorName`, `actorKind`, `message`, and
`afterMoveIndex`. The latter is the number of accepted moves preceding the message, so a value
of 1 places it after `moves[0]`. Message array order breaks ties. Lobby messages have zero preceding
moves; timestamps distinguish them from messages sent after play starts but before the first move.
Human chat and public bot Debug explanations use the same capture path. Explanations are not
private model reasoning and do not enter the bot's factual observations.

Lobby chat is carried into the ensuing round, and post-game discussion remains attached to the
finished round until reset. Chat is retained independently of the activity feed's 1,000-event cap.
A lobby that never starts exists only in active-game persistence, which expires after inactivity.
Chat already lost to reset, truncation, or expiry cannot be recovered from an older transcript.

Authenticated administrators can fetch any stored round with
`GET /api/admin/transcripts/:roundId/export`, including unfinished, reset, and partial recordings.
The replay endpoint and player-facing review remain restricted to complete finished rounds.
Exports contain private full-deck data and must not be exposed to unauthenticated users. The
repository's `hanabi-transcript` skill describes round discovery and private local downloads.

Persistence is asynchronous with bounded retries. A complete recording describes replay coverage,
not proof that every most-recent write survived a crash or database outage. An active export is a
snapshot and can gain later moves and messages. Chat can advance `lifecycle.updatedAt` after a
round ends; `endedAt` remains the gameplay finish time.

`integrity.status: "complete"` means the document has everything required for deterministic replay. A restored game from before transcript support uses `"partial"`, with `deck` and `dealOrder` set to `null`; later accepted moves may still be appended for telemetry, but the document must not be advertised as replayable. `"conflicted"` is reserved for storage reconciliation that detects divergent histories.

Lifecycle status is `in_progress`, `finished`, or `reset`. Reset is a lifecycle outcome, not a player move. `result` exists only for a game completed by the rules and includes the reason, score, and terminal resources.

## Representative document

```json
{
	"version": 1,
	"revision": 3,
	"roundId": "ce19f9f2-cd57-482f-8498-a109d3a03ad4",
	"gameId": "0325aafa-2f77-4ae4-8b47-9f29c832538f",
	"gameCode": "ABCDEF",
	"rules": {
		"ruleSet": "5-color",
		"criticalGameOver": true,
		"allowDragging": true,
		"showNotes": true
	},
	"players": [
		{ "id": "player-a", "name": "Alice" },
		{ "id": "player-b", "name": "Bob" }
	],
	"dealOrder": [
		{ "playerId": "player-a", "tileIds": ["t01", "t02", "t03", "t04", "t05"] },
		{ "playerId": "player-b", "tileIds": ["t06", "t07", "t08", "t09", "t10"] }
	],
	"turnOrder": ["player-b", "player-a"],
	"deck": [
		{ "id": "t01", "color": "red", "number": 1 },
		{ "id": "t02", "color": "blue", "number": 3 },
		{ "id": "t03", "color": "white", "number": 2 },
		{ "id": "t04", "color": "green", "number": 1 },
		{ "id": "t05", "color": "yellow", "number": 4 },
		{ "id": "t06", "color": "red", "number": 2 },
		{ "id": "t07", "color": "blue", "number": 1 },
		{ "id": "t08", "color": "white", "number": 4 },
		{ "id": "t09", "color": "green", "number": 3 },
		{ "id": "t10", "color": "yellow", "number": 1 },
		{ "id": "t11", "color": "red", "number": 3 }
	],
	"moves": [
		{
			"type": "clue",
			"actionId": "0a0791a9-74c7-48a3-988e-f52bdcd0d39f",
			"index": 0,
			"createdAt": "2026-09-02T04:12:03.000Z",
			"actorId": "player-b",
			"recipientId": "player-a",
			"clue": { "type": "color", "value": "red" },
			"selectedTileIds": ["t01"],
			"postTurn": {
				"nextPlayerId": "player-a",
				"clues": 7,
				"lives": 3,
				"remainingTurns": null,
				"score": 0,
				"status": "in_progress"
			}
		},
		{
			"type": "play",
			"actionId": "d16d5aa4-39f6-4d51-82d0-4b35f0048253",
			"index": 1,
			"createdAt": "2026-09-02T04:12:14.000Z",
			"actorId": "player-a",
			"tileId": "t01",
			"valid": true,
			"postTurn": {
				"nextPlayerId": "player-b",
				"clues": 7,
				"lives": 3,
				"remainingTurns": null,
				"score": 1,
				"status": "in_progress"
			}
		}
	],
	"lifecycle": {
		"status": "in_progress",
		"startedAt": "2026-09-02T04:12:00.000Z",
		"updatedAt": "2026-09-02T04:12:14.000Z",
		"endedAt": null
	},
	"integrity": { "status": "complete" }
}
```

The short sample deck is illustrative; a valid complete transcript contains the full ruleset deck. Player names are private telemetry: keep transcripts in private storage, do not log payloads or names, and delete rows manually when removal is required.
