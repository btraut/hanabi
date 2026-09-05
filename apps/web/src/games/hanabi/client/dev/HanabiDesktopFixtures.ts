import {
	generateHanabiGameData,
	getHanabiRuleSetColors,
	HANABI_DEFAULT_TILE_POSITIONS,
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
	HanabiTileNotes,
	Position,
} from '@hanabi/shared';

export type HanabiDesktopFixtureName =
	| 'standard'
	| 'maximum'
	| 'six-color'
	| 'workspace'
	| 'activity'
	| 'action-toasts'
	| 'spectator'
	| 'disconnected'
	| 'bot-thinking'
	| 'bot-error'
	| 'bot-clue'
	| 'bot-result'
	| 'finished';

export interface HanabiDesktopFixture {
	code: string;
	description: string;
	gameData: HanabiGameData;
	name: HanabiDesktopFixtureName;
	userId: string;
}

const PLAYER_NAMES = ['You', 'Alice', 'Miguel', 'Priya', 'Emi'];
type TargetHandTile = readonly [HanabiTileColor, HanabiTileNumber, Position];

const TARGET_HANDS: readonly (readonly TargetHandTile[])[] = [
	[
		['blue', 1, HANABI_DEFAULT_TILE_POSITIONS[0]],
		['green', 2, HANABI_DEFAULT_TILE_POSITIONS[1]],
		['yellow', 3, HANABI_DEFAULT_TILE_POSITIONS[2]],
		['white', 4, HANABI_DEFAULT_TILE_POSITIONS[3]],
		['red', 5, { x: 122, y: 79, z: 1 }],
		['blue', 2, { x: 202, y: 79, z: 2 }],
	],
	[
		['red', 2, HANABI_DEFAULT_TILE_POSITIONS[0]],
		['blue', 4, HANABI_DEFAULT_TILE_POSITIONS[1]],
		['green', 1, HANABI_DEFAULT_TILE_POSITIONS[2]],
		['yellow', 5, HANABI_DEFAULT_TILE_POSITIONS[3]],
		['white', 3, { x: 161, y: 94, z: 1 }],
	],
	[
		['yellow', 1, HANABI_DEFAULT_TILE_POSITIONS[0]],
		['white', 1, HANABI_DEFAULT_TILE_POSITIONS[1]],
		['blue', 3, { x: 89, y: 97, z: 1 }],
		['green', 2, { x: 180, y: 97, z: 2 }],
		['red', 5, { x: 267, y: 97, z: 3 }],
	],
	[
		['green', 5, HANABI_DEFAULT_TILE_POSITIONS[0]],
		['red', 1, HANABI_DEFAULT_TILE_POSITIONS[1]],
		['yellow', 2, HANABI_DEFAULT_TILE_POSITIONS[2]],
		['white', 4, { x: 121, y: 97, z: 1 }],
		['blue', 1, { x: 235, y: 97, z: 2 }],
	],
];

const TARGET_DISCARDS: Readonly<Record<HanabiTileColor, readonly HanabiTileNumber[]>> = {
	red: [1, 4, 2, 1, 3, 4],
	blue: [1, 3, 1, 4, 2, 5, 3],
	green: [1, 3, 2, 5, 1],
	yellow: [4, 1, 2, 4, 3, 5],
	white: [1, 3, 1, 4, 2],
	purple: [],
	rainbow: [],
	black: [],
};

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
	const targetFixture = !withMaximumDiscards && playerCount === 4 && ruleSet === '5-color';
	const { players, turnOrder } = makePlayers(playerCount);
	const tiles: Record<string, HanabiTile> = {};
	const tilePositions: Record<string, Position> = {};
	const tileNotes: Record<string, HanabiTileNotes> = {};
	const playerTiles: Record<string, string[]> = {};

	turnOrder.forEach((playerId, playerIndex) => {
		playerTiles[playerId] = [];
		const targetHand = targetFixture ? TARGET_HANDS[playerIndex] : undefined;
		const handSize = targetHand?.length ?? (playerCount < 4 ? 5 : 4);
		for (let tileIndex = 0; tileIndex < handSize; tileIndex += 1) {
			const colors = getHanabiRuleSetColors(ruleSet);
			const targetTile = targetHand?.[tileIndex];
			const tileId = makeTile(
				tiles,
				targetTile?.[0] ?? colors[(playerIndex + tileIndex) % colors.length],
				targetTile?.[1] ?? ((((tileIndex + playerIndex) % 5) + 1) as HanabiTileNumber),
				`hand-${playerIndex}-${tileIndex}`,
			);
			playerTiles[playerId].push(tileId);
			if (targetTile) {
				tilePositions[tileId] = { ...targetTile[2] };
			} else {
				const freeformStart = playerIndex % 2 === 0 ? 2 : 3;
				const freeform = tileIndex >= freeformStart;
				tilePositions[tileId] = {
					x: freeform
						? 50 + (tileIndex - freeformStart) * 86 + playerIndex * 5
						: HANABI_DEFAULT_TILE_POSITIONS[tileIndex].x,
					y: freeform ? 82 + ((tileIndex + playerIndex) % 2) * 6 : 10,
					z: freeform ? tileIndex : 0,
				};
			}
			tileNotes[tileId] = {
				colors: [],
				numbers: [],
			};
		}
	});

	if (targetFixture) {
		const localHand = playerTiles[turnOrder[0]];
		tileNotes[localHand[1]] = { colors: ['green'], numbers: [2] };
		tileNotes[localHand[4]] = { colors: ['red'], numbers: [5] };
	}

	const playedTiles: string[] = [];
	const playedColors = getHanabiRuleSetColors(ruleSet);
	const playedNumbers: HanabiTileNumber[] = [3, 2, 4, 3, 2, 1, 5];
	playedColors.forEach((color, index) => {
		const topNumber = color === 'black' ? 5 : playedNumbers[index];
		const sequence: HanabiTileNumber[] =
			color === 'black'
				? [5]
				: Array.from(
						{ length: topNumber },
						(_, numberIndex) => (numberIndex + 1) as HanabiTileNumber,
					);
		for (const number of sequence) {
			playedTiles.push(makeTile(tiles, color, number, `played-${index}-${number}`));
		}
	});

	const discardedTiles: string[] = [];
	if (withMaximumDiscards) {
		for (let index = 0; index < 10; index += 1) {
			discardedTiles.push(
				makeTile(tiles, 'red', (((index + 2) % 5) + 1) as HanabiTileNumber, `discard-${index}`),
			);
		}
	} else {
		for (const [color, numbers] of Object.entries(TARGET_DISCARDS) as [
			HanabiTileColor,
			readonly HanabiTileNumber[],
		][]) {
			for (let index = 0; index < numbers.length; index += 1) {
				discardedTiles.push(makeTile(tiles, color, numbers[index], `discard-${color}-${index}`));
			}
		}
	}

	const remainingTiles = Array.from({ length: withMaximumDiscards ? 3 : 23 }, (_, index) =>
		makeTile(tiles, 'blue', ((index % 5) + 1) as HanabiTileNumber, `deck-${index}`),
	);
	const secondHand = playerTiles[turnOrder[1]];
	const thirdHand = playerTiles[turnOrder[2]];
	const fourthHand = playerTiles[turnOrder[3]];
	const playedActionId =
		playedTiles.find((tileId) => tiles[tileId].color === 'red' && tiles[tileId].number === 3) ??
		playedTiles[0];
	const actions: HanabiGameAction[] = targetFixture
		? [
				{
					id: 'action-chat-1',
					message: 'Watch the yellow twos.',
					playerId: turnOrder[2],
					type: HanabiGameActionType.Chat,
				},
				{
					id: 'action-chat-2',
					message: 'The blue clue is safe.',
					playerId: turnOrder[3],
					type: HanabiGameActionType.Chat,
				},
				{
					id: 'action-discard-blue',
					playerId: turnOrder[2],
					tile: { color: 'blue', id: 'history-blue-5', number: 5 },
					type: HanabiGameActionType.Discard,
				},
				{
					id: 'action-clue-white',
					playerId: turnOrder[1],
					recipientId: turnOrder[3],
					tiles: [tiles[fourthHand[3]]],
					color: 'white',
					type: HanabiGameActionType.GiveColorClue,
				},
				{
					id: 'action-discard-yellow',
					playerId: turnOrder[0],
					tile: { color: 'yellow', id: 'history-yellow-2', number: 2 },
					type: HanabiGameActionType.Discard,
				},
				{
					id: 'action-clue-green',
					playerId: turnOrder[3],
					recipientId: turnOrder[2],
					tiles: [tiles[thirdHand[3]], tiles[thirdHand[4]]],
					color: 'green',
					type: HanabiGameActionType.GiveColorClue,
				},
				{
					id: 'action-clue-blue',
					playerId: turnOrder[2],
					recipientId: turnOrder[1],
					tiles: secondHand.slice(0, 4).map((tileId) => tiles[tileId]),
					color: 'blue',
					type: HanabiGameActionType.GiveColorClue,
				},
				{
					id: 'action-play-red',
					playerId: turnOrder[1],
					remainingLives: 2,
					tile: tiles[playedActionId],
					type: HanabiGameActionType.Play,
					valid: true,
				},
			]
		: [
				{
					id: 'action-start',
					startingPlayerId: turnOrder[0],
					type: HanabiGameActionType.GameStarted,
				},
				{
					id: 'action-clue-latest',
					playerId: turnOrder[2],
					recipientId: turnOrder[1],
					tiles: secondHand.map((tileId) => tiles[tileId]),
					color: 'blue',
					type: HanabiGameActionType.GiveColorClue,
				},
			];
	const actionMinutesAgo = targetFixture ? [12, 11, 10, 8, 6, 4, 2, 1] : [12, 1];
	actions.forEach((action, index) => {
		action.createdAt = new Date(Date.now() - actionMinutesAgo[index] * 60_000).toISOString();
	});

	return generateHanabiGameData({
		actions,
		clues: withMaximumDiscards ? 0 : 5,
		creatorId: turnOrder[0],
		currentPlayerId: turnOrder[1],
		discardedTiles,
		lives: withMaximumDiscards ? 1 : 2,
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
	const sixColor = makeFixtureData({ playerCount: 4, ruleSet: '6-color' });
	const maximum = makeFixtureData({
		playerCount: 5,
		ruleSet: 'rainbow-black-powder',
		withMaximumDiscards: true,
	});
	const disconnectedPlayers = { ...standard.players };
	disconnectedPlayers['player-2'] = { ...disconnectedPlayers['player-2'], connected: false };
	const botThinking: HanabiGameData = {
		...standard,
		currentPlayerId: 'player-2',
		players: {
			...standard.players,
			'player-2': { ...standard.players['player-2'], name: 'Bot 1', kind: 'bot' },
		},
		bots: {
			available: true,
			canManage: false,
			turn: { playerId: 'player-2', status: 'thinking', canRetry: false },
		},
	};

	return {
		standard: {
			code: 'X7K2',
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
		'six-color': {
			code: 'VIOLET',
			description: 'Six-color game proving purple cards and tableau treatment at production scale.',
			gameData: sixColor,
			name: 'six-color',
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
			gameData: {
				...standard,
				players: {
					...standard.players,
					'player-2': { ...standard.players['player-2'], name: 'BB-8' },
				},
				actions: (
					[
						{
							id: 'feed-five',
							playerId: 'player-2',
							recipientId: 'player-1',
							number: 5,
							tiles: standard.playerTiles['player-1']
								.map((id) => standard.tiles[id])
								.filter((tile) => tile.number === 5),
							type: HanabiGameActionType.GiveNumberClue,
						},
						{
							id: 'feed-save',
							playerId: 'player-2',
							message: 'The 5 is for later. Keep it out of the discard queue.',
							type: HanabiGameActionType.Chat,
						},
						{
							id: 'feed-discard',
							playerId: 'player-1',
							tile: { id: 'feed-green-four', color: 'green', number: 4 },
							type: HanabiGameActionType.Discard,
						},
						{
							id: 'feed-thanks',
							playerId: 'player-1',
							message: "Got it. I'll keep the 5.",
							type: HanabiGameActionType.Chat,
						},
						{
							id: 'feed-play',
							playerId: 'player-2',
							tile: { id: 'feed-red-three', color: 'red', number: 3 },
							valid: true,
							remainingLives: 2,
							type: HanabiGameActionType.Play,
						},
						{
							id: 'feed-progress',
							playerId: 'player-2',
							message: 'Red is up to 3. We still have two lives.',
							type: HanabiGameActionType.Chat,
						},
						{
							id: 'feed-red',
							playerId: 'player-2',
							recipientId: 'player-1',
							color: 'red',
							tiles: standard.playerTiles['player-1']
								.map((id) => standard.tiles[id])
								.filter((tile) => tile.color === 'red'),
							type: HanabiGameActionType.GiveColorClue,
						},
						{
							id: 'feed-explain',
							playerId: 'player-2',
							message: 'That red clue marks your saved card.',
							type: HanabiGameActionType.Chat,
						},
					] satisfies HanabiGameAction[]
				).map((action, index) => ({
					...action,
					createdAt: new Date(Date.now() - (8 - index) * 60_000).toISOString(),
				})),
			},
			name: 'activity',
			userId: 'player-1',
		},
		'action-toasts': {
			code: 'TOAST',
			description:
				'Interactive incoming clues, plays, and discards with action toast notifications.',
			gameData: standard,
			name: 'action-toasts',
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
		'bot-thinking': {
			code: 'BOTGLOW',
			description: 'A thinking bot with an animated avatar indicator.',
			gameData: botThinking,
			name: 'bot-thinking',
			userId: 'player-1',
		},
		'bot-error': {
			code: 'BOTERROR',
			description: 'A bot request failure with a nonblocking error and automatic retry.',
			gameData: {
				...botThinking,
				bots: {
					...botThinking.bots!,
					turn: {
						...botThinking.bots!.turn!,
						status: 'error',
						message: 'The bot request timed out. Retrying automatically.',
					},
				},
			},
			name: 'bot-error',
			userId: 'player-1',
		},
		'bot-clue': {
			code: 'BOTCLUE',
			description: 'A bot considers a clue while the human keeps their normal turn controls.',
			gameData: {
				...standard,
				currentPlayerId: 'player-1',
				players: {
					...standard.players,
					'player-2': { ...standard.players['player-2'], name: 'Bot 1', kind: 'bot' },
				},
				bots: {
					available: true,
					canManage: false,
					turn: {
						playerId: 'player-2',
						status: 'thinking',
						canRetry: false,
						opportunity: 'clue',
					},
				},
			},
			name: 'bot-clue',
			userId: 'player-1',
		},
		'bot-result': {
			code: 'BOTRESULT',
			description:
				'A bot silently considers its completed action while the next player keeps their turn controls.',
			gameData: {
				...standard,
				currentPlayerId: 'player-1',
				players: {
					...standard.players,
					'player-2': { ...standard.players['player-2'], name: 'Bot 1', kind: 'bot' },
				},
				bots: {
					available: true,
					canManage: false,
					turn: {
						playerId: 'player-2',
						status: 'thinking',
						canRetry: false,
						opportunity: 'result',
					},
				},
			},
			name: 'bot-result',
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
