import {
	getHanabiScore,
	GAME_TRANSCRIPT_VERSION,
	type GameTranscriptMove,
	type GameTranscriptHandMovement,
	type GameTranscriptPlayer,
	type GameTranscriptPostTurn,
	type GameTranscriptResult,
	type GameTranscriptRules,
	type GameTranscriptStatus,
	type GameTranscriptV1,
	HanabiGameAction,
	HanabiGameActionType,
	HanabiGameData,
	HanabiStage,
} from '@hanabi/shared';

export * from '@hanabi/shared/games/hanabi/GameTranscript';

interface GameTranscriptIdentity {
	gameId: string;
	gameCode: string;
}

function resultFor(gameData: HanabiGameData): GameTranscriptResult | undefined {
	if (gameData.stage !== HanabiStage.Finished || gameData.finishedReason === null) {
		return undefined;
	}

	return {
		finishedReason: gameData.finishedReason,
		score: getHanabiScore(gameData),
		clues: gameData.clues,
		lives: gameData.lives,
		remainingTurns: gameData.remainingTurns,
	};
}

function statusFor(gameData: HanabiGameData): Exclude<GameTranscriptStatus, 'reset'> {
	return gameData.stage === HanabiStage.Finished ? 'finished' : 'in_progress';
}

function postTurnFor(gameData: HanabiGameData): GameTranscriptPostTurn {
	const result = resultFor(gameData);
	return {
		tilePositions: structuredClone(gameData.tilePositions),
		nextPlayerId: gameData.currentPlayerId,
		clues: gameData.clues,
		lives: gameData.lives,
		remainingTurns: gameData.remainingTurns,
		score: getHanabiScore(gameData),
		status: statusFor(gameData),
		...(result ? { result } : {}),
	};
}

function rulesFor(gameData: HanabiGameData): GameTranscriptRules {
	return {
		ruleSet: gameData.ruleSet,
		criticalGameOver: gameData.criticalGameOver,
		allowDragging: gameData.allowDragging,
		showNotes: gameData.showNotes,
	};
}

function playersFor(gameData: HanabiGameData): GameTranscriptPlayer[] {
	return Object.values(gameData.players).map(({ id, name }) => ({ id, name }));
}

export function createGameTranscript(
	identity: GameTranscriptIdentity,
	gameData: HanabiGameData,
	startedAt: string,
): GameTranscriptV1 {
	const players = playersFor(gameData);
	const dealOrder = players.map(({ id }) => ({
		playerId: id,
		tileIds: [...gameData.playerTiles[id]],
	}));
	const deckIds = [
		...dealOrder.flatMap(({ tileIds }) => tileIds),
		...[...gameData.remainingTiles].reverse(),
	];

	return {
		version: GAME_TRANSCRIPT_VERSION,
		revision: 1,
		roundId: gameData.seed,
		gameId: identity.gameId,
		gameCode: identity.gameCode,
		rules: rulesFor(gameData),
		players,
		dealOrder,
		turnOrder: [...gameData.turnOrder],
		deck: deckIds.map((tileId) => ({ ...gameData.tiles[tileId] })),
		moves: [],
		initialTilePositions: structuredClone(gameData.tilePositions),
		handMovements: [],
		lifecycle: {
			status: statusFor(gameData),
			startedAt,
			updatedAt: startedAt,
			endedAt: null,
		},
		integrity: { status: 'complete' },
	};
}

export function createPartialGameTranscript(
	identity: GameTranscriptIdentity,
	gameData: HanabiGameData,
	updatedAt: string,
	reason = 'The active game predates transcript persistence, so its original deal and moves are unavailable.',
): GameTranscriptV1 {
	const result = resultFor(gameData);
	const status = statusFor(gameData);
	return {
		version: GAME_TRANSCRIPT_VERSION,
		revision: 1,
		roundId: gameData.seed,
		gameId: identity.gameId,
		gameCode: identity.gameCode,
		rules: rulesFor(gameData),
		players: playersFor(gameData),
		dealOrder: null,
		turnOrder: [...gameData.turnOrder],
		deck: null,
		moves: [],
		lifecycle: {
			status,
			startedAt: null,
			updatedAt,
			endedAt: status === 'finished' ? updatedAt : null,
		},
		integrity: { status: 'partial', reason },
		...(result ? { result } : {}),
	};
}

function moveFor(
	transcript: GameTranscriptV1,
	action: HanabiGameAction,
	gameData: HanabiGameData,
): GameTranscriptMove {
	if (!action.createdAt) {
		throw new Error('Accepted Hanabi actions must have a timestamp before transcription.');
	}

	const baseFor = (actorId: string) => ({
		actionId: action.id,
		index: transcript.moves.length,
		createdAt: action.createdAt!,
		actorId,
		postTurn: postTurnFor(gameData),
	});

	switch (action.type) {
		case HanabiGameActionType.Play:
			return {
				...baseFor(action.playerId),
				type: 'play',
				tileId: action.tile.id,
				valid: action.valid,
			};
		case HanabiGameActionType.Discard:
			return { ...baseFor(action.playerId), type: 'discard', tileId: action.tile.id };
		case HanabiGameActionType.GiveColorClue:
			return {
				...baseFor(action.playerId),
				type: 'clue',
				recipientId: action.recipientId,
				clue: { type: 'color', value: action.color! },
				selectedTileIds: action.tiles.map(({ id }) => id),
			};
		case HanabiGameActionType.GiveNumberClue:
			return {
				...baseFor(action.playerId),
				type: 'clue',
				recipientId: action.recipientId,
				clue: { type: 'number', value: action.number! },
				selectedTileIds: action.tiles.map(({ id }) => id),
			};
		default:
			throw new Error(`Hanabi action ${action.type} is not a transcript move.`);
	}
}

export function appendGameTranscriptMove(
	transcript: GameTranscriptV1,
	action: HanabiGameAction,
	gameData: HanabiGameData,
): GameTranscriptV1 {
	const move = moveFor(transcript, action, gameData);
	const result = resultFor(gameData);
	const status = statusFor(gameData);
	return {
		...transcript,
		revision: transcript.revision + 1,
		moves: [...transcript.moves, move],
		lifecycle: {
			...transcript.lifecycle,
			status,
			updatedAt: move.createdAt,
			endedAt: status === 'finished' ? move.createdAt : null,
		},
		...(result ? { result } : {}),
	};
}

export function appendGameTranscriptHandMovement(
	transcript: GameTranscriptV1,
	movement: Omit<GameTranscriptHandMovement, 'type' | 'afterMoveIndex'>,
): GameTranscriptV1 {
	return {
		...transcript,
		revision: transcript.revision + 1,
		handMovements: [
			...(transcript.handMovements ?? []),
			{ ...structuredClone(movement), type: 'reposition', afterMoveIndex: transcript.moves.length },
		],
		lifecycle: { ...transcript.lifecycle, updatedAt: movement.createdAt },
	};
}

export function resetGameTranscript(
	transcript: GameTranscriptV1,
	resetAt: string,
): GameTranscriptV1 {
	if (transcript.lifecycle.status !== 'in_progress') {
		return transcript;
	}

	return {
		...transcript,
		revision: transcript.revision + 1,
		lifecycle: {
			...transcript.lifecycle,
			status: 'reset',
			updatedAt: resetAt,
			endedAt: resetAt,
		},
	};
}

export function transcriptMatchesRound(
	value: unknown,
	identity: GameTranscriptIdentity,
	gameData: HanabiGameData,
): value is GameTranscriptV1 {
	if (!value || typeof value !== 'object') return false;
	const candidate = value as Partial<GameTranscriptV1>;
	const lifecycle = candidate.lifecycle;
	const integrity = candidate.integrity;
	if (!lifecycle || typeof lifecycle !== 'object' || !integrity || typeof integrity !== 'object') {
		return false;
	}
	return (
		candidate.version === GAME_TRANSCRIPT_VERSION &&
		candidate.roundId === gameData.seed &&
		candidate.gameId === identity.gameId &&
		candidate.gameCode === identity.gameCode &&
		Number.isInteger(candidate.revision) &&
		(candidate.revision ?? 0) >= 1 &&
		Array.isArray(candidate.players) &&
		Array.isArray(candidate.turnOrder) &&
		Array.isArray(candidate.moves) &&
		(candidate.dealOrder === null || Array.isArray(candidate.dealOrder)) &&
		(candidate.deck === null || Array.isArray(candidate.deck)) &&
		['in_progress', 'finished', 'reset'].includes(lifecycle.status) &&
		['complete', 'partial', 'conflicted'].includes(integrity.status)
	);
}
