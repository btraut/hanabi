import {
	generateHanabiGameData,
	HanabiFinishedReason,
	HanabiGameAction,
	HanabiGameActionType,
	HanabiGameData,
	HanabiPlayer,
	HanabiRuleSet,
	HanabiStage,
	HanabiTile,
	HanabiTileColor,
	HanabiTileNumber,
	Position,
} from '@hanabi/shared';

export type HanabiDesktopFixtureName =
	'standard' | 'maximum' | 'workspace' | 'activity' | 'spectator' | 'disconnected' | 'finished';

export interface HanabiDesktopFixture {
	code: string;
	description: string;
	gameData: HanabiGameData;
	name: HanabiDesktopFixtureName;
	userId: string;
}

const PLAYER_NAMES = ['Alice', 'Ben', 'Chika', 'Diego', 'Emi'];

function makePlayers(count: number): {
	players: Record<string, HanabiPlayer>;
	turnOrder: string[];
} {
	const players: Record<string, HanabiPlayer> = {};
	const turnOrder: string[] = [];
	for (let index = 0; index < count; index += 1) {
		const id = `player-${index + 1}`;
		players[id] = { connected: true, id, name: PLAYER_NAMES[index] };
		turnOrder.push(id);
	}
	return { players, turnOrder };
}

function makeTile(
	tiles: Record<string, HanabiTile>,
	color: HanabiTileColor,
	number: HanabiTileNumber,
	label: string,
): string {
	const id = `${label}-${color}-${number}`;
	tiles[id] = { color, id, number };
	return id;
}

function makeFixtureData({
	playerCount,
	ruleSet,
	withMaximumDiscards = false,
}: {
	playerCount: number;
	ruleSet: HanabiRuleSet;
	withMaximumDiscards?: boolean;
}): HanabiGameData {
	const { players, turnOrder } = makePlayers(playerCount);
	const tiles: Record<string, HanabiTile> = {};
	const tilePositions: Record<string, Position> = {};
	const tileNotes: HanabiGameData['tileNotes'] = {};
	const playerTiles: Record<string, string[]> = {};

	turnOrder.forEach((playerId, playerIndex) => {
		playerTiles[playerId] = [];
		for (let tileIndex = 0; tileIndex < (playerCount < 4 ? 5 : 4); tileIndex += 1) {
			const colors: HanabiTileColor[] = ['red', 'blue', 'green', 'yellow', 'white'];
			const tileId = makeTile(
				tiles,
				colors[(playerIndex + tileIndex) % colors.length],
				(((tileIndex + playerIndex) % 5) + 1) as HanabiTileNumber,
				`hand-${playerIndex}-${tileIndex}`,
			);
			playerTiles[playerId].push(tileId);
			const freeform = tileIndex >= 2 && playerIndex % 2 === 0;
			tilePositions[tileId] = {
				x: 10 + tileIndex * 50 + (freeform ? playerIndex * 4 : 0),
				y: freeform ? 78 + (tileIndex % 2) * 10 : 10,
				z: freeform ? tileIndex : 0,
			};
			(tileNotes as Record<string, { colors: []; numbers: [] }>)[tileId] = {
				colors: [],
				numbers: [],
			};
		}
	});

	const playedTiles: string[] = [];
	const playedColors: HanabiTileColor[] =
		ruleSet === 'rainbow-black-powder'
			? ['blue', 'green', 'yellow', 'white', 'rainbow', 'black']
			: ['red', 'blue', 'green', 'yellow', 'white'];
	playedColors.forEach((color, index) => {
		playedTiles.push(
			makeTile(
				tiles,
				color,
				color === 'black' ? 5 : (((index % 3) + 1) as HanabiTileNumber),
				`played-${index}`,
			),
		);
	});

	const discardedTiles: string[] = [];
	const discardCount = withMaximumDiscards ? 10 : 6;
	for (let index = 0; index < discardCount; index += 1) {
		discardedTiles.push(
			makeTile(tiles, 'red', (((index + 2) % 5) + 1) as HanabiTileNumber, `discard-${index}`),
		);
	}

	const remainingTiles = Array.from({ length: withMaximumDiscards ? 3 : 21 }, (_, index) =>
		makeTile(tiles, 'blue', ((index % 5) + 1) as HanabiTileNumber, `deck-${index}`),
	);
	const actions: HanabiGameAction[] = [
		{ id: 'action-start', startingPlayerId: turnOrder[0], type: HanabiGameActionType.GameStarted },
		{
			id: 'action-chat-1',
			message: 'Watch the yellow twos.',
			playerId: turnOrder[1],
			type: HanabiGameActionType.Chat,
		},
		{
			id: 'action-discard-1',
			playerId: turnOrder[0],
			tile: tiles[discardedTiles[0]],
			type: HanabiGameActionType.Discard,
		},
	];

	return generateHanabiGameData({
		actions,
		clues: withMaximumDiscards ? 0 : 5,
		creatorId: turnOrder[0],
		currentPlayerId: turnOrder[1],
		discardedTiles,
		lives: withMaximumDiscards ? 1 : 3,
		playedTiles,
		playerTiles,
		players,
		remainingTiles,
		ruleSet,
		seed: `desktop-${ruleSet}-${playerCount}`,
		stage: HanabiStage.Playing,
		tileNotes,
		tilePositions,
		tiles,
		turnOrder,
	});
}

export function getHanabiDesktopFixtures(): Record<HanabiDesktopFixtureName, HanabiDesktopFixture> {
	const standard = makeFixtureData({ playerCount: 4, ruleSet: '5-color' });
	const maximum = makeFixtureData({
		playerCount: 5,
		ruleSet: 'rainbow-black-powder',
		withMaximumDiscards: true,
	});
	const disconnectedPlayers = { ...standard.players };
	disconnectedPlayers['player-2'] = { ...disconnectedPlayers['player-2'], connected: false };

	return {
		standard: {
			code: 'NIGHT5',
			description: 'Four players, standard rules, representative live game.',
			gameData: standard,
			name: 'standard',
			userId: 'player-1',
		},
		maximum: {
			code: 'MAX777',
			description: 'Five players, seven colors, ten same-color discards, and a short deck.',
			gameData: maximum,
			name: 'maximum',
			userId: 'player-1',
		},
		workspace: {
			code: 'SPLIT5',
			description: 'Mixed ordered and freeform hand coordinates with overlap.',
			gameData: standard,
			name: 'workspace',
			userId: 'player-1',
		},
		activity: {
			code: 'CHAT22',
			description: 'Gameplay and chat actions ready for the desktop activity rail.',
			gameData: { ...standard, actions: [...standard.actions, ...standard.actions] },
			name: 'activity',
			userId: 'player-1',
		},
		spectator: {
			code: 'WATCH1',
			description: 'A viewer who is not one of the players.',
			gameData: standard,
			name: 'spectator',
			userId: 'spectator',
		},
		disconnected: {
			code: 'AWAY22',
			description: 'The active player is disconnected.',
			gameData: { ...standard, players: disconnectedPlayers },
			name: 'disconnected',
			userId: 'player-1',
		},
		finished: {
			code: 'FINISH',
			description: 'A completed game with no active player treatment.',
			gameData: {
				...standard,
				currentPlayerId: null,
				finishedReason: HanabiFinishedReason.OutOfTurns,
				stage: HanabiStage.Finished,
			},
			name: 'finished',
			userId: 'player-1',
		},
	};
}
