# Hanabi Game Transcript v1

Hanabi game transcripts are server-only replay and telemetry documents. One transcript represents one round, identified by the round seed in `roundId`; resetting a lobby ends the current round and a later start creates another transcript under the same `gameId`.

## Replay semantics

- `players` preserves the player iteration order used when dealing. `dealOrder` records each player's initial hand in the exact order it was dealt.
- `deck` contains every tile exactly once in first-consumed-first order. Its prefix is the full hands in `dealOrder`; its suffix is the remaining draw stack reversed from the runtime's internal array because gameplay draws with `pop()`.
- `turnOrder` is the independently randomized player order. It must not be inferred from `players` or `dealOrder`.
- `moves` contains only accepted play, discard, and clue actions in server order. Chat, tile positioning, connection changes, and rejected requests are excluded.
- Each move contains the source action ID and timestamp, a zero-based index, action-specific input and outcome, and the authoritative post-turn state. A terminal move carries the result both in `postTurn.result` and at the transcript root.
- `revision` starts at 1 for the round-start snapshot and increases for every accepted move or reset finalization. Recorder implementations may use it to reject stale snapshots.

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
