import {
	getNewPositionsForTiles,
	getHanabiPositionsForLayout,
	packHanabiHandPositions,
	addToTileNotes,
	getHanabiCompletionTileCount,
	getHanabiClueColors,
	doesHanabiTileMatchClue,
	canHanabiPlayerDiscard,
	getHanabiFireworkSequence,
	generateHanabiGameData,
	generatePlayer,
	generateRandomDeck,
	HANABI_CLUE_COLORS,
	isHanabiFireworkCompletion,
	isHanabiRuleSet,
	isReplayableTranscript,
	HANABI_BOARD_SIZE,
	HANABI_DEFAULT_TILE_POSITIONS,
	HANABI_GAME_TITLE,
	HANABI_MAX_ACTIONS,
	HANABI_MAX_CHAT_LENGTH,
	HANABI_MAX_CLUES,
	HANABI_MAX_PLAYERS,
	HANABI_MIN_PLAYERS,
	HANABI_TILE_SIZE,
	HANABI_TILES_IN_HAND,
	HanabiFinishedReason,
	HanabiGameAction,
	HanabiClueColor,
	HanabiGameActionType,
	HanabiGameData,
	HanabiStage,
	HanabiTile,
	Position,
	AddPlayerMessage,
	ChangeGameSettingsMessage,
	CreateDebugPlayerMessage,
	DebugPlayerAction,
	DebugPlayerActionMessage,
	DiscardTileMessage,
	getScope,
	GiveClueMessage,
	HanabiMessage,
	MoveTilesMessage,
	PlayTileMessage,
	RemovePlayerMessage,
	ResetGameMessage,
	SendChatMessage,
	StartGameMessage,
	shuffle,
} from '@hanabi/shared';
import Game, { GameSerialized } from '../server/Game.js';
import GameMessenger from '../server/GameMessenger.js';
import { SaveGameDelegate } from '../server/GameStore.js';
import UserConnectionListener, { UserConnectionChange } from '../server/UserConnectionListener.js';
import ServerSocketManager from '../../utils/SocketManager.js';
import Logger from '../../utils/Logger.js';
import { randomUUID } from 'node:crypto';
import {
	appendGameTranscriptMove,
	appendGameTranscriptHandMovement,
	createGameTranscript,
	createPartialGameTranscript,
	GameTranscriptV1,
	resetGameTranscript,
	transcriptMatchesRound,
} from './GameTranscript.js';
import { GameTranscriptRecorder, NOOP_GAME_TRANSCRIPT_RECORDER } from './GameTranscriptRecorder.js';
import { BotRuntime } from './bots/BotRuntime.js';
import { BotTurnCoordinator, type BotTurn } from './bots/BotTurnCoordinator.js';
import { type BotRound } from './bots/BotRound.js';
import { createBotHistory, appendBotHistory, appendBotArrangement } from './bots/BotHistory.js';
import { createRoundBotPolicy } from './bots/BotPolicy.js';
import { isV2BotDecision, type BotDecision } from './bots/OpenAiBot.js';
import { getBotLegalActions } from './bots/BotLegalActions.js';
import { createBotDecisionChat } from './bots/BotDecisionChat.js';
import { getBotNotepadCheckpoint } from './bots/BotNotepad.js';
import { chooseBotName } from './bots/BotNames.js';

export interface HanabiGameSerialized extends GameSerialized {
	data: HanabiGameData;
	transcript?: GameTranscriptV1 | null;
	botRound?: BotRound | null;
}

const INVALID_MESSAGE_PAYLOAD = 'Invalid message payload.';
const READ_ACTIVITY_SAVE_INTERVAL_MS = 60_000;
type ActionResponseDelegate = (data: { error?: string }) => void;

const DEBUG_PLAYER_NAME = 'Debug Player';

export default class HanabiGame extends Game {
	get title(): string {
		return HANABI_GAME_TITLE;
	}

	private _gameData: HanabiGameData = generateHanabiGameData();

	private _messenger: GameMessenger<HanabiMessage>;
	private _userConnectionListener: UserConnectionListener;
	private _lastReadActivitySaveAt = 0;
	private readonly _debugPlayerControls: boolean;
	private _transcript: GameTranscriptV1 | null = null;
	private _botRound: BotRound | null = null;
	private readonly _botCoordinator?: BotTurnCoordinator;
	private readonly _resultCoordinator?: BotTurnCoordinator;
	private _resultTurn: BotTurn | null = null;
	private _resultAccounting = { attempts: 0, tokens: 0 };
	private _backgroundStarted = false;

	constructor(
		creatorIdOrData: string | HanabiGameSerialized,
		socketManager: ServerSocketManager,
		saveGameDelegate: SaveGameDelegate,
		private readonly _minimumPlayers = HANABI_MIN_PLAYERS,
		debugPlayerControls = false,
		private readonly _transcriptRecorder: GameTranscriptRecorder = NOOP_GAME_TRANSCRIPT_RECORDER,
		private readonly _botRuntime?: BotRuntime,
	) {
		super(
			typeof creatorIdOrData === 'string' ? creatorIdOrData : creatorIdOrData.creatorId,
			saveGameDelegate,
		);
		this._debugPlayerControls = debugPlayerControls;

		if (typeof creatorIdOrData === 'string') {
			this._gameData = generateHanabiGameData({ creatorId: creatorIdOrData });
		} else {
			this._id = creatorIdOrData.id;
			this._code = creatorIdOrData.code;
			this._creatorId = creatorIdOrData.creatorId;
			this._created = new Date(creatorIdOrData.created);
			this._updated = new Date(creatorIdOrData.updated);
			this._gameData = {
				...creatorIdOrData.data,
				creatorId: creatorIdOrData.creatorId,
				players: Object.fromEntries(
					Object.entries(creatorIdOrData.data.players).map(([id, player]) => [
						id,
						{ ...player, connected: player.kind === 'bot' },
					]),
				),
			};
			// Review data belongs to recipient snapshots, never authoritative game state.
			delete this._gameData.reviewTranscript;
			delete this._gameData.bots;
			this._botRound = creatorIdOrData.botRound ? structuredClone(creatorIdOrData.botRound) : null;
			if (this._botRound?.pendingResult) {
				this._botRound.pendingResults = [this._botRound.pendingResult];
				delete this._botRound.pendingResult;
				this._botRound.status = 'ready';
				delete this._botRound.failure;
			}
			if (
				this._botRound &&
				['round_budget', 'global_budget'].includes(this._botRound.failure ?? '')
			) {
				this._botRound.status = 'ready';
				delete this._botRound.failure;
			}
			if (this._gameData.stage !== HanabiStage.Setup) {
				const identity = { gameId: this.id, gameCode: this.code };
				this._transcript = transcriptMatchesRound(
					creatorIdOrData.transcript,
					identity,
					this._gameData,
				)
					? structuredClone(creatorIdOrData.transcript)
					: createPartialGameTranscript(identity, this._gameData, this.updated.toISOString());
				this._recordTranscriptSnapshot();
			}
		}

		this._messenger = new GameMessenger(socketManager, getScope(HANABI_GAME_TITLE, this.id));
		this._messenger.connect(this._handleMessage);

		this._userConnectionListener = new UserConnectionListener(socketManager);
		this._userConnectionListener.start(this._handleUserConnectionChange);
		if (_botRuntime) {
			this._botCoordinator = new BotTurnCoordinator(_botRuntime, {
				gameId: this.id,
				getTurn: () => this._currentBotTurn(),
				persist: async () => {
					this._update();
					await this.flushSaves();
				},
				onFailure: () => {
					if (this._discardFailedOptionalResponse()) this._invalidateBotTurn(true);
				},
				notify: () => {
					this._broadcastGameData();
					this._update();
				},
				apply: (playerId, action, decision) => this._applyBotDecision(playerId, action, decision),
				applyClueResponse: (playerId, decision, sourceIds) =>
					this._applyBotDecision(playerId, null, decision, sourceIds),
			});
			this._resultCoordinator = new BotTurnCoordinator(_botRuntime, {
				gameId: this.id,
				getTurn: () => this._resultTurn,
				persist: async () => {
					this._update();
					await this.flushSaves();
				},
				notify: () => {
					this._accountForResult();
					this._update();
				},
				onFailure: () => this._finishResult(),
				apply: () => 'Result reflections cannot take a turn.',
				applyResultResponse: (playerId, decision, sourceId) =>
					this._applyBotDecision(playerId, null, decision, [], sourceId),
			});
		}
	}

	public override startBackgroundWork(): void {
		this._backgroundStarted = true;
		this._startNextResult();
		this._resultCoordinator?.start();
		this._botCoordinator?.start();
	}

	public override stopBackgroundWork(): void {
		this._backgroundStarted = false;
		this._botCoordinator?.stop();
		this._resultCoordinator?.stop();
		this._accountForResult();
		this._resultTurn = null;
	}

	public cleanUp(): void {
		this.stopBackgroundWork();
		this._messenger.disconnect();
		this._userConnectionListener.stop();
	}

	public serialize(): string | null {
		const baseSerialized = this._getBaseData();
		const serialized: HanabiGameSerialized = {
			...baseSerialized,
			data: this._gameData,
			transcript: this._transcript,
			...(this._botRound ? { botRound: this._botRound } : {}),
		};
		return JSON.stringify(serialized);
	}

	private _getAllPlayerAndWatcherIds(): string[] {
		return [...new Set([...this.watchers, ...Object.keys(this._gameData.players)])];
	}

	private _isRecord(value: unknown): value is Record<string, unknown> {
		return typeof value === 'object' && value !== null && !Array.isArray(value);
	}

	private _messagePayloadIsValid(message: HanabiMessage): boolean {
		const data: unknown = message.data;
		switch (message.type) {
			case 'GetGameDataMessage':
			case 'StartGameMessage':
			case 'ResetGameMessage':
			case 'AddBotMessage':
			case 'RetryBotTurnMessage':
				return data === undefined;
			case 'AddPlayerMessage':
				return this._isRecord(data) && typeof data.name === 'string';
			case 'RemovePlayerMessage':
				return (
					this._isRecord(data) && (data.playerId === undefined || typeof data.playerId === 'string')
				);
			case 'ChangeGameSettingsMessage':
				return (
					this._isRecord(data) &&
					Object.keys(data).every((key) =>
						['ruleSet', 'allowDragging', 'showNotes', 'criticalGameOver'].includes(key),
					) &&
					(data.ruleSet === undefined || isHanabiRuleSet(data.ruleSet)) &&
					(data.allowDragging === undefined || typeof data.allowDragging === 'boolean') &&
					(data.showNotes === undefined || typeof data.showNotes === 'boolean') &&
					(data.criticalGameOver === undefined || typeof data.criticalGameOver === 'boolean')
				);
			case 'SendChatMessage':
				return typeof data === 'string';
			case 'PlayTileMessage':
			case 'DiscardTileMessage':
				return this._isRecord(data) && typeof data.id === 'string';
			case 'GiveClueMessage':
				return (
					this._isRecord(data) &&
					typeof data.to === 'string' &&
					(data.color === undefined || typeof data.color === 'string') &&
					(data.number === undefined || typeof data.number === 'number')
				);
			case 'MoveTilesMessage':
				return this._isRecord(data);
			default:
				return true;
		}
	}

	private _sendInvalidPayloadResponse(userId: string, message: HanabiMessage): void {
		const data = { error: INVALID_MESSAGE_PAYLOAD };
		switch (message.type) {
			case 'GetGameDataMessage':
				this._sendGameData(userId);
				break;
			case 'AddPlayerMessage':
				this._messenger.send(userId, { type: 'AddPlayerResponseMessage', data });
				break;
			case 'AddBotMessage':
				this._messenger.send(userId, { type: 'AddBotResponseMessage', data });
				break;
			case 'RetryBotTurnMessage':
				this._messenger.send(userId, { type: 'RetryBotTurnResponseMessage', data });
				break;
			case 'RemovePlayerMessage':
				this._messenger.send(userId, { type: 'RemovePlayerResponseMessage', data });
				break;
			case 'ChangeGameSettingsMessage':
				this._messenger.send(userId, { type: 'ChangeGameSettingsResponseMessage', data });
				break;
			case 'SendChatMessage':
				this._messenger.send(userId, { type: 'SendChatResponseMessage', data });
				break;
			case 'StartGameMessage':
				this._messenger.send(userId, { type: 'StartGameResponseMessage', data });
				break;
			case 'ResetGameMessage':
				this._messenger.send(userId, { type: 'ResetGameResponseMessage', data });
				break;
			case 'PlayTileMessage':
				this._messenger.send(userId, { type: 'PlayTileResponseMessage', data });
				break;
			case 'DiscardTileMessage':
				this._messenger.send(userId, { type: 'DiscardTileResponseMessage', data });
				break;
			case 'GiveClueMessage':
				this._messenger.send(userId, { type: 'GiveClueResponseMessage', data });
				break;
			case 'MoveTilesMessage':
				this._messenger.send(userId, { type: 'MoveTilesResponseMessage', data });
				break;
		}
	}

	private _gameDataForRecipient(userId: string): HanabiGameData {
		const currentPlayer =
			this._gameData.currentPlayerId && this._gameData.players[this._gameData.currentPlayerId];
		const bots = {
			available: !!this._botRuntime,
			canManage:
				this._gameData.stage === HanabiStage.Setup &&
				userId === this.creatorId &&
				!!this._gameData.players[userId] &&
				this._gameData.players[userId].kind !== 'bot',
			turn:
				this._botCoordinator?.status() ??
				(!this._botCoordinator &&
				this._gameData.stage === HanabiStage.Playing &&
				currentPlayer &&
				currentPlayer.kind === 'bot'
					? {
							playerId: currentPlayer.id,
							status: 'disabled' as const,
							canRetry: false,
							message:
								'Bots are unavailable. Ask the server operator to enable them, or reset the game to remove bot seats.',
						}
					: null),
		};
		if (this._gameData.stage === HanabiStage.Finished) {
			const transcript = this._transcript;
			if (transcript && isReplayableTranscript(transcript)) {
				return { ...this._gameData, bots, reviewTranscript: structuredClone(transcript) };
			}
			return { ...this._gameData, bots };
		}

		const concealedTileIds = new Set(this._gameData.remainingTiles);
		for (const tileId of this._gameData.playerTiles[userId] ?? []) {
			concealedTileIds.add(tileId);
		}
		const tiles = { ...this._gameData.tiles };
		for (const tileId of concealedTileIds) {
			if (tiles[tileId]) {
				tiles[tileId] = { id: tileId, color: 'white', number: 1, concealed: true };
			}
		}
		const actions = this._gameData.actions.map((action) => {
			if (
				action.type !== HanabiGameActionType.GiveColorClue &&
				action.type !== HanabiGameActionType.GiveNumberClue
			) {
				return action;
			}
			return {
				...action,
				tiles: action.tiles.map(({ id }) => ({
					id,
					color: 'white' as const,
					number: 1 as const,
					concealed: true as const,
				})),
			};
		});

		return { ...this._gameData, seed: '', tiles, actions, bots };
	}

	private _broadcastGameData(additionalUserIds: readonly string[] = []): void {
		for (const userId of new Set([...additionalUserIds, ...this._getAllPlayerAndWatcherIds()])) {
			this._messenger.send(userId, {
				type: 'RefreshGameDataMessage',
				data: this._gameDataForRecipient(userId),
			});
		}
	}

	private _appendActions(...actions: HanabiGameAction[]): HanabiGameAction[] {
		const timestampedActions = actions.map((action) => ({
			...action,
			createdAt: action.createdAt ?? new Date().toISOString(),
		}));
		this._gameData.actions = [...this._gameData.actions, ...timestampedActions].slice(
			-HANABI_MAX_ACTIONS,
		);
		return timestampedActions;
	}

	private _recordTranscriptSnapshot(): void {
		if (!this._transcript) return;
		try {
			this._transcriptRecorder.record(structuredClone(this._transcript));
		} catch (error) {
			Logger.error(
				`Failed to record Hanabi transcript for game ${this.id}, round ${this._transcript.roundId}.`,
				error,
			);
		}
	}

	private _recordAcceptedMove(action: HanabiGameAction, before?: HanabiGameData): void {
		if (this._botRound) {
			const previousOpportunity = before ? this._botOpportunityKey(before) : undefined;
			this._botRound.history = appendBotHistory(
				this._botRound.history,
				action,
				this._gameData,
				before,
			);
			this._queueBotClueOpportunity(action);
			this._queueBotResultOpportunity(action);
			const opportunityChanged = !before || previousOpportunity !== this._botOpportunityKey();
			const skippedFailedClue = !opportunityChanged && this._discardFailedOptionalResponse();
			this._invalidateBotTurn(opportunityChanged || skippedFailedClue);
		}
		if (!this._transcript) {
			this._transcript = createPartialGameTranscript(
				{ gameId: this.id, gameCode: this.code },
				this._gameData,
				action.createdAt ?? new Date().toISOString(),
			);
		}
		this._transcript = appendGameTranscriptMove(this._transcript, action, this._gameData);
		this._recordTranscriptSnapshot();
	}

	private _handleMessage = ({
		userId,
		message,
	}: {
		userId: string;
		message: HanabiMessage;
	}): void => {
		// Bot seats have no socket credentials; only the internal dispatcher may act for them.
		if (this._gameData.players[userId]?.kind === 'bot' || userId.startsWith('bot:')) return;
		if (!this._messagePayloadIsValid(message)) {
			this._sendInvalidPayloadResponse(userId, message);
			return;
		}

		switch (message.type) {
			case 'GetGameDataMessage':
				this._sendGameData(userId);
				break;
			case 'AddPlayerMessage':
				this._handleAddPlayerMessage(message, userId);
				break;
			case 'AddBotMessage':
				this._handleAddBot(userId);
				break;
			case 'RetryBotTurnMessage': {
				const player = this._gameData.players[userId];
				const error =
					!player || player.kind === 'bot'
						? 'Only players can retry the bot.'
						: (this._botCoordinator?.retry() ??
							(this._botCoordinator ? null : 'Bots are unavailable.'));
				this._messenger.send(userId, {
					type: 'RetryBotTurnResponseMessage',
					data: error ? { error } : {},
				});
				break;
			}
			case 'RemovePlayerMessage':
				this._handleRemovePlayerMessage(message, userId);
				break;
			case 'CreateDebugPlayerMessage':
				this._handleCreateDebugPlayerMessage(message, userId);
				break;
			case 'DebugPlayerActionMessage':
				this._handleDebugPlayerActionMessage(message, userId);
				break;
			case 'ChangeGameSettingsMessage':
				this._handleChangeGameSettingsMessage(message, userId);
				break;
			case 'SendChatMessage':
				this._handleSendChatMessage(message, userId);
				break;
			case 'StartGameMessage':
				this._handleStartGameMessage(message, userId);
				break;
			case 'PlayTileMessage':
				this._handlePlayTileMessage(message, userId);
				break;
			case 'DiscardTileMessage':
				this._handleDiscardTileMessage(message, userId);
				break;
			case 'GiveClueMessage':
				this._handleGiveClueMessage(message, userId);
				break;
			case 'MoveTilesMessage':
				this._handleMoveTilesMessage(message, userId);
				break;
			case 'ResetGameMessage':
				this._handleResetGameMessage(message, userId);
				break;
		}
	};

	private _handleUserConnectionChange = (userId: string, change: UserConnectionChange) => {
		if (!this._gameData.players[userId] || this._gameData.players[userId].kind === 'bot') {
			return;
		}

		this._gameData.players[userId].connected = change === UserConnectionChange.Authenticated;

		this._broadcastGameData();

		// Touch the games last updated time.
		this._update();
	};

	private _sendGameData(playerId: string): void {
		this._messenger.send(playerId, {
			type: 'RefreshGameDataMessage',
			data: this._gameDataForRecipient(playerId),
		});

		// Reads keep active games from being pruned, but persist that access at most
		// once per minute so refresh storms cannot saturate the backing store.
		const now = Date.now();
		this._updated = new Date(now);
		if (now - this._lastReadActivitySaveAt >= READ_ACTIVITY_SAVE_INTERVAL_MS) {
			this._lastReadActivitySaveAt = now;
			this._update();
		}
	}

	private _handleAddPlayerMessage({ data: { name } }: AddPlayerMessage, playerId: string): void {
		// Error if already started.
		if (this._gameData.stage !== HanabiStage.Setup) {
			this._messenger.send(playerId, {
				type: 'AddPlayerResponseMessage',
				data: {
					error: 'Cannot join game because it has already started.',
				},
			});
			return;
		}
		const trimmedName = typeof name === 'string' ? name.trim() : '';
		if (!trimmedName || trimmedName.length > 40) {
			this._messenger.send(playerId, {
				type: 'AddPlayerResponseMessage',
				data: { error: 'Names must be between 1 and 40 characters.' },
			});
			return;
		}
		if (
			!this._gameData.players[playerId] &&
			Object.keys(this._gameData.players).length >= HANABI_MAX_PLAYERS
		) {
			this._messenger.send(playerId, {
				type: 'AddPlayerResponseMessage',
				data: { error: `Hanabi supports at most ${HANABI_MAX_PLAYERS} players.` },
			});
			return;
		}

		// Add the player to the player list.
		this._addPlayer(playerId, trimmedName);

		// Success! Respond to the creator.
		this._messenger.send(playerId, {
			type: 'AddPlayerResponseMessage',
			data: {},
		});

		// Send the updated state to all players/watchers.
		this._broadcastGameData();

		// Touch the games last updated time.
		this._update();
	}

	private _addPlayer(playerId: string, name: string): void {
		const player = generatePlayer({ id: playerId, name });
		this._gameData.players = { ...this._gameData.players, [playerId]: player };
	}

	private _handleAddBot(userId: string): void {
		const error = !this._botRuntime
			? 'Bots are unavailable on this server.'
			: userId !== this.creatorId || !this._gameData.players[userId]
				? 'Only the joined host can add a bot.'
				: this._gameData.stage !== HanabiStage.Setup
					? 'Cannot add a bot after the game has started.'
					: Object.keys(this._gameData.players).length >= HANABI_MAX_PLAYERS
						? `Hanabi supports at most ${HANABI_MAX_PLAYERS} players.`
						: null;
		if (error) {
			this._messenger.send(userId, { type: 'AddBotResponseMessage', data: { error } });
			return;
		}
		const playerId = `bot:${randomUUID()}`;
		const name = chooseBotName(Object.values(this._gameData.players).map((player) => player.name));
		this._gameData.players = {
			...this._gameData.players,
			[playerId]: generatePlayer({ id: playerId, name, kind: 'bot' }),
		};
		this._messenger.send(userId, { type: 'AddBotResponseMessage', data: { playerId } });
		this._broadcastGameData();
		this._update();
	}

	/** Each reflection keeps its observation while other players continue taking turns. */
	private _startNextResult(): void {
		const round = this._botRound;
		const pending = round?.pendingResults?.[0];
		if (!this._backgroundStarted || this._resultTurn || !round || !pending) return;
		this._resultTurn = {
			playerId: pending.playerId,
			gameData: structuredClone(this._gameData),
			round: { ...structuredClone(round), status: 'ready', attempts: 0, tokens: 0 },
			opportunity: 'result',
			sourceActionEventId: pending.eventId,
		};
		this._resultAccounting = { attempts: 0, tokens: 0 };
		this._resultCoordinator?.changed();
	}

	private _accountForResult(): void {
		const work = this._resultTurn?.round;
		if (!work || !this._botRound) return;
		this._botRound.attempts += work.attempts - this._resultAccounting.attempts;
		this._botRound.tokens += work.tokens - this._resultAccounting.tokens;
		this._resultAccounting = { attempts: work.attempts, tokens: work.tokens };
	}

	private _finishResult(layoutChanged = false): void {
		const previousTurn = this._currentBotTurn();
		this._accountForResult();
		if (this._botRound) {
			this._botRound.pendingResults = this._botRound.pendingResults?.filter(
				(pending) => pending.eventId !== this._resultTurn?.sourceActionEventId,
			);
		}
		this._resultTurn = null;
		this._resultCoordinator?.changed();
		const nextTurn = this._currentBotTurn();
		const opportunityChanged =
			previousTurn?.playerId !== nextTurn?.playerId ||
			previousTurn?.opportunity !== nextTurn?.opportunity;
		const capacityFreed = this._botRound?.failure === 'busy';
		if (layoutChanged || opportunityChanged || capacityFreed)
			this._invalidateBotTurn(opportunityChanged || capacityFreed);
		queueMicrotask(() => this._startNextResult());
	}

	private _currentBotTurn(gameData: HanabiGameData = this._gameData): BotTurn | null {
		const round = this._botRound;
		const reflecting = (id: string) => round?.pendingResults?.some((p) => p.playerId === id);
		const pending =
			round?.version === 2 ? round.pendingClues?.find((p) => !reflecting(p.playerId)) : undefined;
		const playerId = pending?.playerId ?? gameData.currentPlayerId;
		if (
			gameData.stage !== HanabiStage.Playing ||
			!playerId ||
			gameData.players[playerId]?.kind !== 'bot' ||
			!round ||
			reflecting(playerId)
		)
			return null;
		return {
			playerId,
			gameData,
			round,
			...(round.version === 2
				? {
						opportunity:
							playerId === gameData.currentPlayerId ? ('turn' as const) : ('clue' as const),
						sourceClueEventIds: pending?.eventIds ?? [],
					}
				: {}),
		};
	}

	/** Failed clue responses cannot block another bot's turn. */
	private _discardFailedOptionalResponse(): boolean {
		const round = this._botRound;
		if (!round || round.version !== 2 || !['error', 'exhausted'].includes(round.status))
			return false;

		const pending = round.pendingClues?.find(
			(p) => p.playerId === this._currentBotTurn()?.playerId,
		);
		const currentPlayerId = this._gameData.currentPlayerId;
		if (
			!pending ||
			!currentPlayerId ||
			pending.playerId === currentPlayerId ||
			this._gameData.players[currentPlayerId]?.kind !== 'bot'
		)
			return false;
		Logger.warn(
			`Skipped failed optional bot clue response game=${this.id} player=${pending.playerId} code=${round.failure ?? 'transient'}`,
		);
		round.pendingClues = round.pendingClues!.filter((entry) => entry !== pending);
		return true;
	}

	private _botOpportunityKey(gameData: HanabiGameData = this._gameData): string {
		const turn = this._currentBotTurn(gameData);
		return JSON.stringify([turn?.playerId, turn?.opportunity, turn?.sourceClueEventIds ?? []]);
	}

	private _invalidateBotTurn(advance: boolean): void {
		if (!this._botRound) return;
		this._botRound.revision += 1;
		if (advance || this._botRound.status === 'thinking') {
			this._botRound.status = 'ready';
			delete this._botRound.failure;
		}
		this._botCoordinator?.changed();
	}

	private _applyPlayerAction(playerId: string, action: DebugPlayerAction): string | null {
		let error: string | null = null;
		const respond: ActionResponseDelegate = (result) => {
			error = result.error ?? null;
		};
		const scope = getScope(HANABI_GAME_TITLE, this.id);
		switch (action.type) {
			case 'play':
				this._handlePlayTileMessage(
					{ scope, type: 'PlayTileMessage', data: { id: action.tileId } },
					playerId,
					respond,
				);
				break;
			case 'discard':
				this._handleDiscardTileMessage(
					{ scope, type: 'DiscardTileMessage', data: { id: action.tileId } },
					playerId,
					respond,
				);
				break;
			case 'clue':
				this._handleGiveClueMessage(
					{
						scope,
						type: 'GiveClueMessage',
						data: { to: action.to, color: action.color, number: action.number },
					},
					playerId,
					respond,
				);
				break;
		}
		return error;
	}

	private _applyBotDecision(
		playerId: string,
		action: DebugPlayerAction | null,
		decision?: BotDecision,
		sourceClueEventIds?: string[],
		sourceActionEventId?: string,
	): string | null {
		const round = this._botRound;
		if (!round || round.version === 1)
			return action ? this._applyPlayerAction(playerId, action) : 'Invalid bot opportunity.';
		const hand = this._gameData.playerTiles[playerId] ?? [];
		const opportunity = action ? 'turn' : sourceActionEventId ? 'result' : 'clue';
		const current = opportunity === 'result' ? this._resultTurn : this._currentBotTurn();
		if (opportunity === 'result' && decision && this._gameData.stage === HanabiStage.Finished)
			decision = { ...decision, arrangement: null };
		if (
			this._gameData.players[playerId]?.kind !== 'bot' ||
			current?.playerId !== playerId ||
			current.opportunity !== opportunity ||
			!isV2BotDecision(
				decision,
				hand,
				this._gameData.allowDragging && this._gameData.stage === HanabiStage.Playing,
				opportunity,
				round.policy.notepadVersion === 1,
			) ||
			(action !== null &&
				!getBotLegalActions(this._gameData, playerId).some(
					(candidate) =>
						candidate.id === decision.actionId &&
						JSON.stringify(candidate.action) === JSON.stringify(action),
				)) ||
			(opportunity === 'clue' &&
				JSON.stringify(current.sourceClueEventIds) !== JSON.stringify(sourceClueEventIds)) ||
			(opportunity === 'result' && current.sourceActionEventId !== sourceActionEventId)
		)
			return 'Invalid bot decision.';

		const positions =
			decision.arrangement === null
				? null
				: getHanabiPositionsForLayout(hand, decision.arrangement);
		if (decision.arrangement !== null && !positions) return 'Invalid bot arrangement.';
		const beforePositions = this._gameData.tilePositions;
		const beforeTranscript = this._transcript;
		const beforeHistory = round.history;
		const observedAt = getBotNotepadCheckpoint(
			opportunity === 'result' ? current.round.history : beforeHistory,
		);
		const beforePendingClues = round.pendingClues;
		const sources = current.sourceClueEventIds ?? [];
		// All checks finish before mutation; these synchronous handlers cannot interleave.
		// Stage the arrangement without notifications or invalidating its own request.
		if (positions) this._commitArrangement(playerId, positions, sources.at(-1));
		if (opportunity !== 'result')
			round.pendingClues = round.pendingClues?.filter((pending) => pending.playerId !== playerId);
		const error = action ? this._applyPlayerAction(playerId, action) : null;
		if (error) {
			this._gameData.tilePositions = beforePositions;
			this._transcript = beforeTranscript;
			round.history = beforeHistory;
			round.pendingClues = beforePendingClues;
			return error;
		}
		const decisionId = randomUUID();
		if (round.policy.notepadVersion === 1) {
			const notepad = round.notepads?.[playerId] ?? { version: 1 as const, entries: [] };
			round.notepads = {
				...round.notepads,
				[playerId]: {
					version: 1,
					entries: [
						...notepad.entries,
						{
							decisionId,
							opportunity,
							observedAt,
							recordedAt: getBotNotepadCheckpoint(round.history),
							sourceClueEventIds: [...sources],
							...(sourceActionEventId ? { sourceActionEventId } : {}),
							explanation: decision.explanation,
							notes: decision.notes ?? null,
						},
					],
				},
			};
		}
		this._appendActions(createBotDecisionChat(playerId, decisionId, decision.explanation));
		if (!action) {
			if (this._transcript !== beforeTranscript) this._recordTranscriptSnapshot();
			if (opportunity === 'result') this._finishResult(this._transcript !== beforeTranscript);
			else this._invalidateBotTurn(true);
		}
		this._broadcastGameData();
		this._update();
		return null;
	}

	private _commitArrangement(
		playerId: string,
		positions: Record<string, Position>,
		sourceClueEventId?: string,
	): boolean {
		const previous = this._gameData.tilePositions;
		const changedPositions = Object.fromEntries(
			Object.entries(positions).filter(([id, next]) => {
				const current = previous[id];
				return current.x !== next.x || current.y !== next.y || current.z !== next.z;
			}),
		);
		if (Object.keys(changedPositions).length === 0) return false;
		this._gameData.tilePositions = { ...previous, ...positions };
		if (this._botRound)
			this._botRound.history = appendBotArrangement(
				this._botRound.history,
				playerId,
				previous,
				this._gameData,
				sourceClueEventId,
			);
		const createdAt = new Date().toISOString();
		this._transcript ??= createPartialGameTranscript(
			{ gameId: this.id, gameCode: this.code },
			this._gameData,
			createdAt,
		);
		this._transcript = appendGameTranscriptHandMovement(this._transcript, {
			id: randomUUID(),
			createdAt,
			actorId: playerId,
			positions: changedPositions,
		});
		return true;
	}

	private _queueBotClueOpportunity(action: HanabiGameAction): void {
		const round = this._botRound;
		if (
			!round ||
			round.version !== 2 ||
			round.history.version !== 2 ||
			!round.policy.arrangementAfterClue ||
			!this._gameData.allowDragging ||
			this._gameData.stage !== HanabiStage.Playing ||
			(action.type !== HanabiGameActionType.GiveColorClue &&
				action.type !== HanabiGameActionType.GiveNumberClue) ||
			this._gameData.players[action.recipientId]?.kind !== 'bot'
		)
			return;
		const sourceClueEventId = round.history.events.at(-1)?.eventId;
		if (!sourceClueEventId) return;
		const playerId = action.recipientId;
		const pending = round.pendingClues?.find((entry) => entry.playerId === playerId);
		if (pending) pending.eventIds = [...pending.eventIds, sourceClueEventId];
		else
			round.pendingClues = [
				...(round.pendingClues ?? []),
				{ playerId, eventIds: [sourceClueEventId] },
			];
	}

	private _queueBotResultOpportunity(action: HanabiGameAction): void {
		const round = this._botRound;
		if (
			!round ||
			round.version !== 2 ||
			round.history.version !== 2 ||
			!round.policy.reflectionAfterAction ||
			(action.type !== HanabiGameActionType.Play && action.type !== HanabiGameActionType.Discard) ||
			this._gameData.players[action.playerId]?.kind !== 'bot'
		)
			return;
		const event = round.history.events.at(-1);
		if (event?.type !== 'play' && event?.type !== 'discard') return;
		round.pendingResults = [
			...(round.pendingResults ?? []),
			{ playerId: action.playerId, eventId: event.eventId },
		];
		queueMicrotask(() => this._startNextResult());
	}

	private _debugPlayerId(): string {
		return `debug:${this.creatorId}`;
	}

	private _handleCreateDebugPlayerMessage(
		_message: CreateDebugPlayerMessage,
		userId: string,
	): void {
		const respond = (data: { playerId?: string; error?: string }) => {
			this._messenger.send(userId, { type: 'CreateDebugPlayerResponseMessage', data });
		};

		if (!this._debugPlayerControls) {
			respond({ error: 'Debug player controls are disabled.' });
			return;
		}
		if (userId !== this.creatorId || !this._gameData.players[userId]) {
			respond({ error: 'Only the joined host can create a debug player.' });
			return;
		}
		if (this._gameData.stage !== HanabiStage.Setup) {
			respond({ error: 'Cannot add a debug player after the game has started.' });
			return;
		}

		const debugPlayerId = this._debugPlayerId();
		if (!this._gameData.players[debugPlayerId]) {
			if (Object.keys(this._gameData.players).length >= HANABI_MAX_PLAYERS) {
				respond({ error: `Hanabi supports at most ${HANABI_MAX_PLAYERS} players.` });
				return;
			}
			this._addPlayer(debugPlayerId, DEBUG_PLAYER_NAME);
		}

		respond({ playerId: debugPlayerId });
		this._messenger.send(this._getAllPlayerAndWatcherIds(), {
			type: 'RefreshGameDataMessage',
			data: this._gameData,
		});
		this._update();
	}

	private _isDebugPlayerAction(value: unknown): value is DebugPlayerAction {
		if (!value || typeof value !== 'object') {
			return false;
		}

		const action = value as Record<string, unknown>;
		if (action.type === 'play' || action.type === 'discard') {
			return typeof action.tileId === 'string';
		}
		if (action.type !== 'clue' || typeof action.to !== 'string') {
			return false;
		}

		const numbers = [1, 2, 3, 4, 5];
		const hasColor = action.color !== undefined;
		const hasNumber = action.number !== undefined;
		return (
			hasColor !== hasNumber &&
			(!hasColor || HANABI_CLUE_COLORS.includes(action.color as HanabiClueColor)) &&
			(!hasNumber || numbers.includes(action.number as number))
		);
	}

	private _handleDebugPlayerActionMessage(message: DebugPlayerActionMessage, userId: string): void {
		const respond: ActionResponseDelegate = (data) => {
			this._messenger.send(userId, { type: 'DebugPlayerActionResponseMessage', data });
		};

		if (!this._debugPlayerControls) {
			respond({ error: 'Debug player controls are disabled.' });
			return;
		}
		if (userId !== this.creatorId || !this._gameData.players[userId]) {
			respond({ error: 'Only the joined host can control the debug player.' });
			return;
		}

		const debugPlayerId = this._debugPlayerId();
		if (!this._gameData.players[debugPlayerId]) {
			respond({ error: 'Debug player has not been created.' });
			return;
		}

		const data = message.data as unknown;
		const action =
			data && typeof data === 'object' ? (data as { action?: unknown }).action : undefined;
		if (!this._isDebugPlayerAction(action)) {
			respond({ error: 'Invalid debug player action.' });
			return;
		}

		switch (action.type) {
			case 'play':
				this._handlePlayTileMessage(
					{ ...message, type: 'PlayTileMessage', data: { id: action.tileId } },
					debugPlayerId,
					respond,
				);
				break;
			case 'discard':
				this._handleDiscardTileMessage(
					{ ...message, type: 'DiscardTileMessage', data: { id: action.tileId } },
					debugPlayerId,
					respond,
				);
				break;
			case 'clue':
				this._handleGiveClueMessage(
					{
						...message,
						type: 'GiveClueMessage',
						data: { to: action.to, color: action.color, number: action.number },
					},
					debugPlayerId,
					respond,
				);
				break;
		}
	}

	private _handleRemovePlayerMessage(
		{ data: { playerId } }: RemovePlayerMessage,
		userId: string,
	): void {
		const removeUserId = playerId || userId;

		// Error if already started.
		if (this._gameData.stage !== HanabiStage.Setup) {
			this._messenger.send(userId, {
				type: 'RemovePlayerResponseMessage',
				data: {
					error: 'Cannot remove user from game because it has already started.',
				},
			});
			return;
		}
		if (removeUserId !== userId && this.creatorId !== userId) {
			this._messenger.send(userId, {
				type: 'RemovePlayerResponseMessage',
				data: { error: 'Only the host can remove another player.' },
			});
			return;
		}

		const { [removeUserId]: _removedPlayer, ...remainingPlayers } = this._gameData.players;
		if (_removedPlayer?.kind === 'bot' && !this._gameData.players[userId]) {
			this._messenger.send(userId, {
				type: 'RemovePlayerResponseMessage',
				data: { error: 'Only the joined host can remove a bot.' },
			});
			return;
		}
		this._gameData.players = remainingPlayers;

		this._messenger.send(userId, {
			type: 'RemovePlayerResponseMessage',
			data: {},
		});

		// Send the updated state to all players/watchers.
		this._broadcastGameData([userId]);

		// Touch the games last updated time.
		this._update();
	}

	private _handleChangeGameSettingsMessage(
		message: ChangeGameSettingsMessage,
		userId: string,
	): void {
		// Basic validation:
		if (this._gameData.stage !== HanabiStage.Setup) {
			this._messenger.send(userId, {
				type: 'ChangeGameSettingsResponseMessage',
				data: {
					error: 'Cannot change game settings after it has started.',
				},
			});
			return;
		}

		if (!this._gameData.players[userId]) {
			this._messenger.send(userId, {
				type: 'ChangeGameSettingsResponseMessage',
				data: {
					error: 'Only players can change game settings.',
				},
			});
			return;
		}

		// Settings specific validation:
		if (message.data.ruleSet) {
			if (!isHanabiRuleSet(message.data.ruleSet)) {
				this._messenger.send(userId, {
					type: 'ChangeGameSettingsResponseMessage',
					data: {
						error: 'Invalid rules set.',
					},
				});
				return;
			}

			this._gameData.ruleSet = message.data.ruleSet;
		}

		if (message.data.allowDragging !== undefined) {
			this._gameData.allowDragging = message.data.allowDragging;
		}

		if (message.data.showNotes !== undefined) {
			this._gameData.showNotes = message.data.showNotes;
		}

		if (message.data.criticalGameOver !== undefined) {
			this._gameData.criticalGameOver = message.data.criticalGameOver;
		}

		// Success!
		this._messenger.send(userId, {
			type: 'ChangeGameSettingsResponseMessage',
			data: {},
		});

		// Send the updated state to all players/watchers.
		this._broadcastGameData();

		// Touch the games last updated time.
		this._update();
	}

	private _handleSendChatMessage(message: SendChatMessage, userId: string): void {
		const chat = typeof message.data === 'string' ? message.data.trim() : '';
		if (!this._gameData.players[userId] || !chat || chat.length > HANABI_MAX_CHAT_LENGTH) {
			this._messenger.send(userId, {
				type: 'SendChatResponseMessage',
				data: {
					error: `Chat messages must be between 1 and ${HANABI_MAX_CHAT_LENGTH} characters.`,
				},
			});
			return;
		}

		// Add the chat action.
		this._appendActions({
			id: randomUUID(),
			type: HanabiGameActionType.Chat,
			playerId: userId,
			message: chat,
		});

		// Success!
		this._messenger.send(userId, {
			type: 'SendChatResponseMessage',
			data: {},
		});

		// Send the updated state to all players/watchers.
		this._broadcastGameData();

		// Touch the games last updated time.
		this._update();
	}

	private _handleStartGameMessage(_message: StartGameMessage, userId: string): void {
		// Validate that the game is ready.
		if (this._gameData.stage !== HanabiStage.Setup) {
			this._messenger.send(userId, {
				type: 'StartGameResponseMessage',
				data: {
					error: 'Cannot start game because it has already started.',
				},
			});
			return;
		}

		const playerCount = Object.keys(this._gameData.players).length;
		if (playerCount < this._minimumPlayers) {
			this._messenger.send(userId, {
				type: 'StartGameResponseMessage',
				data: {
					error: 'Not enough players to play.',
				},
			});
			return;
		}
		if (playerCount > HANABI_MAX_PLAYERS) {
			this._messenger.send(userId, {
				type: 'StartGameResponseMessage',
				data: { error: `Hanabi supports at most ${HANABI_MAX_PLAYERS} players.` },
			});
			return;
		}

		if (!this._gameData.players[userId]) {
			this._messenger.send(userId, {
				type: 'StartGameResponseMessage',
				data: {
					error: 'Only players can start the game.',
				},
			});
			return;
		}

		// Start the game!
		if (
			Object.values(this._gameData.players).some((player) => player.kind === 'bot') &&
			!this._botRuntime
		) {
			this._messenger.send(userId, {
				type: 'StartGameResponseMessage',
				data: { error: 'Bots are unavailable. Remove bot seats to start a human game.' },
			});
			return;
		}
		this._gameData.stage = HanabiStage.Playing;

		// Generate a fresh deck and randomize the tiles.
		const players = Object.values(this._gameData.players);
		const [tiles, remainingTiles] = generateRandomDeck(this._gameData.ruleSet, this._gameData.seed);
		const tilesInHand = HANABI_TILES_IN_HAND[players.length];

		const newPlayerTiles: { [playerId: string]: string[] } = {};
		const newPositions: { [tileId: string]: Position } = {};

		for (const player of players) {
			newPlayerTiles[player.id] = [];

			for (let i = 0; i < tilesInHand; i += 1) {
				const tileId = remainingTiles.pop()!;
				newPlayerTiles[player.id].push(tileId);
				newPositions[tileId] = { ...HANABI_DEFAULT_TILE_POSITIONS[i] };
			}
		}

		this._gameData.playerTiles = { ...this._gameData.playerTiles, ...newPlayerTiles };
		this._gameData.tilePositions = { ...this._gameData.tilePositions, ...newPositions };

		this._gameData.tiles = tiles;
		this._gameData.remainingTiles = remainingTiles;

		// Set up turn order.
		this._gameData.turnOrder = shuffle(players.map((player) => player.id));
		this._gameData.currentPlayerId = this._gameData.turnOrder[0];
		if (this._botRuntime && players.some((player) => player.kind === 'bot')) {
			this._botRound = {
				version: 2,
				roundId: this._gameData.seed,
				policy: createRoundBotPolicy(this._botRuntime.policy, this._gameData),
				history: createBotHistory(this._gameData, 2),
				revision: 0,
				attempts: 0,
				tokens: 0,
				status: 'ready',
				lastAttemptAt: 0,
				pendingClues: [],
				notepads: {},
			};
		}

		// Record the action.
		const [startedAction] = this._appendActions({
			id: randomUUID(),
			type: HanabiGameActionType.GameStarted,
			startingPlayerId: this._gameData.currentPlayerId,
		});
		this._transcript = createGameTranscript(
			{ gameId: this.id, gameCode: this.code },
			this._gameData,
			startedAction.createdAt!,
		);
		this._recordTranscriptSnapshot();

		// Send success message.
		this._messenger.send(userId, {
			type: 'StartGameResponseMessage',
			data: {},
		});

		// Send the updated state to all players/watchers.
		this._broadcastGameData();

		// Touch the games last updated time.
		this._update();
		this._botCoordinator?.changed();
	}

	private _validateGameAction(userId: string): string | null {
		if (!this._gameData.players[userId]) {
			return 'Invalid player!';
		}

		if (this._gameData.stage !== HanabiStage.Playing) {
			return "The game isn't being played right now.";
		}

		if (this._gameData.currentPlayerId !== userId) {
			return "It's not your turn!";
		}

		return null;
	}

	private _discardedTileIsFatal(tile: HanabiTile): boolean {
		const { tiles } = this._gameData;

		// Check if the tile has already been played.
		if (
			this._gameData.playedTiles.find(
				(tid: string) => tiles[tid].color === tile.color && tiles[tid].number === tile.number,
			)
		) {
			return false;
		}

		// Check remaining tiles for a copy.
		if (
			this._gameData.remainingTiles.find(
				(tid: string) => tiles[tid].color === tile.color && tiles[tid].number === tile.number,
			)
		) {
			return false;
		}

		// Check players' hands for a copy.
		for (const playerTiles of Object.values(this._gameData.playerTiles)) {
			for (const tid of playerTiles) {
				if (tiles[tid].color === tile.color && tiles[tid].number === tile.number) {
					return false;
				}
			}
		}

		// No copy left in play. Game is failed.
		return true;
	}

	private _pickUpNextTile(userId: string): void {
		if (this._gameData.remainingTiles.length === 0) {
			throw new Error('No tiles left to pick up!');
		}

		const newTileId = this._gameData.remainingTiles[this._gameData.remainingTiles.length - 1];
		this._gameData.remainingTiles = this._gameData.remainingTiles.slice(0, -1);
		const newPosition = { x: Number.MAX_SAFE_INTEGER, y: 0, z: 0 };

		const tilePositions: { [tileId: string]: Position } = {};
		for (const tileId of this._gameData.playerTiles[userId]) {
			tilePositions[tileId] = this._gameData.tilePositions[tileId];
		}

		const newTilePositions = getNewPositionsForTiles(
			{ [newTileId]: newPosition },
			tilePositions,
			true,
		);

		this._gameData.tilePositions = { ...this._gameData.tilePositions, ...newTilePositions };

		this._gameData.playerTiles[userId].push(newTileId);
	}

	private _getNextUserId(turnOrder: readonly string[], currentUser: string | null): string | null {
		if (currentUser === null) {
			return null;
		}

		const currentIndex = turnOrder.indexOf(currentUser);

		if (currentIndex === -1) {
			return null;
		}

		const nextIndex = (currentIndex + 1) % turnOrder.length;
		return turnOrder[nextIndex];
	}

	private _completeTurn(
		userId: string,
		options: { startShotClockIfDeckEmpty?: boolean; gameWon?: boolean } = {},
	): void {
		if (
			this._gameData.remainingTurns === null &&
			options.startShotClockIfDeckEmpty &&
			this._gameData.remainingTiles.length === 0
		) {
			this._gameData.remainingTurns = Object.keys(this._gameData.players).length;
			this._appendActions({
				id: randomUUID(),
				playerId: userId,
				type: HanabiGameActionType.ShotClockStarted,
				remainingTurns: this._gameData.remainingTurns,
			});
		} else if (this._gameData.remainingTurns !== null) {
			this._gameData.remainingTurns -= 1;
			if (this._gameData.remainingTurns === 0) {
				this._gameData.stage = HanabiStage.Finished;
				this._gameData.finishedReason = HanabiFinishedReason.OutOfTurns;
			} else {
				this._appendActions({
					id: randomUUID(),
					playerId: userId,
					type: HanabiGameActionType.ShotClockTickedDown,
					remainingTurns: this._gameData.remainingTurns,
				});
			}
		}

		if (options.gameWon) {
			this._gameData.stage = HanabiStage.Finished;
			this._gameData.finishedReason = HanabiFinishedReason.Won;
		}

		this._gameData.currentPlayerId = this._getNextUserId(
			this._gameData.turnOrder,
			this._gameData.currentPlayerId,
		);
		if (this._gameData.finishedReason !== null) {
			this._appendActions({
				id: randomUUID(),
				type: HanabiGameActionType.GameFinished,
				finishedReason: this._gameData.finishedReason,
			});
		}
	}

	private _handlePlayTileMessage(
		message: PlayTileMessage,
		userId: string,
		respond: ActionResponseDelegate = (data) =>
			this._messenger.send(userId, { type: 'PlayTileResponseMessage', data }),
	): void {
		const { tiles } = this._gameData;

		const gameActionError = this._validateGameAction(userId);
		if (gameActionError) {
			respond({ error: gameActionError });
			return;
		}
		const tile = this._gameData.tiles[message.data.id];

		if (!tile || !this._gameData.playerTiles[userId].includes(tile.id)) {
			respond({ error: "That tile isn't in your hand!" });
			return;
		}
		const before = this._botRound?.version === 2 ? structuredClone(this._gameData) : undefined;

		// Remove the tile from the player.
		const newPlayerTiles = this._gameData.playerTiles[userId].filter(
			(tid: string) => tid !== tile.id,
		);
		this._gameData.playerTiles = { ...this._gameData.playerTiles, [userId]: newPlayerTiles };

		// Pick up another tile if available.
		if (this._gameData.remainingTiles.length) {
			this._pickUpNextTile(userId);
		} else {
			this._gameData.tilePositions = {
				...this._gameData.tilePositions,
				...packHanabiHandPositions(newPlayerTiles, this._gameData.tilePositions),
			};
		}

		// Check if the tile is valid. If so, play it.
		const duplicate = !!this._gameData.playedTiles.find(
			(tid: string) => tiles[tid].color === tile.color && tiles[tid].number === tile.number,
		);
		const fireworkSequence = getHanabiFireworkSequence(tile.color);
		const tileSequenceIndex = fireworkSequence.indexOf(tile.number);
		const previousNumberInSequence = fireworkSequence[tileSequenceIndex - 1];
		const prevNumberInSequenceExists = !!(
			tileSequenceIndex === 0 ||
			this._gameData.playedTiles.find(
				(tid: string) =>
					tiles[tid].color === tile.color && tiles[tid].number === previousNumberInSequence,
			)
		);

		const tileIsValid = !duplicate && prevNumberInSequenceExists;

		if (tileIsValid) {
			this._gameData.playedTiles = [...this._gameData.playedTiles, tile.id];

			if (isHanabiFireworkCompletion(tile) && this._gameData.clues !== HANABI_MAX_CLUES) {
				this._gameData.clues += 1;
			}
		} else {
			this._gameData.lives -= 1;

			if (this._gameData.lives === 0) {
				this._gameData.stage = HanabiStage.Finished;
				this._gameData.finishedReason = HanabiFinishedReason.OutOfLives;
			}

			this._gameData.discardedTiles = [...this._gameData.discardedTiles, tile.id];
		}

		// Remove the tile position.
		const newPositions = { ...this._gameData.tilePositions };
		delete newPositions[tile.id];
		this._gameData.tilePositions = newPositions;

		// Detect if the game is over due to the wrong tile being discarded.
		if (this._gameData.criticalGameOver && !tileIsValid && this._discardedTileIsFatal(tile)) {
			this._gameData.stage = HanabiStage.Finished;
			this._gameData.finishedReason = HanabiFinishedReason.DiscardedFatalTile;
		}

		// Record the action.
		const [playAction] = this._appendActions({
			id: randomUUID(),
			playerId: userId,
			type: HanabiGameActionType.Play,
			tile,
			valid: tileIsValid,
			remainingLives: this._gameData.lives,
		});

		const maxPlayedTiles = getHanabiCompletionTileCount(this._gameData.ruleSet);
		this._completeTurn(userId, {
			startShotClockIfDeckEmpty: true,
			gameWon: this._gameData.playedTiles.length === maxPlayedTiles,
		});
		this._recordAcceptedMove(playAction, before);

		// Send success message.
		respond({});

		// Send the updated state to all players/watchers.
		this._broadcastGameData();

		// Touch the games last updated time.
		this._update();
	}

	private _handleDiscardTileMessage(
		message: DiscardTileMessage,
		userId: string,
		respond: ActionResponseDelegate = (data) =>
			this._messenger.send(userId, { type: 'DiscardTileResponseMessage', data }),
	): void {
		const gameActionError = this._validateGameAction(userId);
		if (gameActionError) {
			respond({ error: gameActionError });
			return;
		}
		if (!canHanabiPlayerDiscard(this._gameData.clues)) {
			respond({ error: 'Cannot discard when all clues are available.' });
			return;
		}

		const tile = this._gameData.tiles[message.data.id];

		if (!tile || !this._gameData.playerTiles[userId].includes(tile.id)) {
			respond({ error: "That tile isn't in your hand!" });
			return;
		}
		const before = this._botRound?.version === 2 ? structuredClone(this._gameData) : undefined;

		// Remove the tile from the player.
		const newPlayerTiles = this._gameData.playerTiles[userId].filter(
			(tid: string) => tid !== tile.id,
		);
		this._gameData.playerTiles = { ...this._gameData.playerTiles, [userId]: newPlayerTiles };

		// Add the tile to discarded tiles.
		this._gameData.discardedTiles = [...this._gameData.discardedTiles, tile.id];

		// Pick up another tile if available.
		if (this._gameData.remainingTiles.length) {
			this._pickUpNextTile(userId);
		} else {
			this._gameData.tilePositions = {
				...this._gameData.tilePositions,
				...packHanabiHandPositions(newPlayerTiles, this._gameData.tilePositions),
			};
		}

		// Remove the tile position.
		const newPositions = { ...this._gameData.tilePositions };
		delete newPositions[tile.id];
		this._gameData.tilePositions = newPositions;

		// Record the action.
		const [discardAction] = this._appendActions({
			id: randomUUID(),
			playerId: userId,
			type: HanabiGameActionType.Discard,
			tile,
		});

		// Detect if the game is over due to the wrong tile being discarded.
		if (this._gameData.criticalGameOver && this._discardedTileIsFatal(tile)) {
			this._gameData.stage = HanabiStage.Finished;
			this._gameData.finishedReason = HanabiFinishedReason.DiscardedFatalTile;
		}

		// Add a clue.
		if (this._gameData.clues !== HANABI_MAX_CLUES) {
			this._gameData.clues += 1;
		}

		this._completeTurn(userId, { startShotClockIfDeckEmpty: true });
		this._recordAcceptedMove(discardAction, before);

		// Send success message.
		respond({});

		// Send the updated state to all players/watchers.
		this._broadcastGameData();

		// Touch the games last updated time.
		this._update();
	}

	private _handleGiveClueMessage(
		message: GiveClueMessage,
		userId: string,
		respond: ActionResponseDelegate = (data) =>
			this._messenger.send(userId, { type: 'GiveClueResponseMessage', data }),
	): void {
		const gameActionError = this._validateGameAction(userId);
		if (gameActionError) {
			respond({ error: gameActionError });
			return;
		}

		// Make sure the clue is for a single number or color.
		if (message.data.color !== undefined && message.data.number !== undefined) {
			respond({ error: 'Can only give a clue for a single number or color at a time.' });
			return;
		}
		if (message.data.color === undefined && message.data.number === undefined) {
			respond({ error: 'Clues must contain a number or color.' });
			return;
		}
		if (message.data.to === userId) {
			respond({ error: 'You cannot give yourself a clue.' });
			return;
		}
		const validColorClues = getHanabiClueColors(this._gameData.ruleSet);
		if (
			(message.data.color !== undefined && !validColorClues.includes(message.data.color)) ||
			(message.data.number !== undefined && ![1, 2, 3, 4, 5].includes(message.data.number))
		) {
			respond({ error: 'Invalid clue.' });
			return;
		}

		const recipientTiles = Object.hasOwn(this._gameData.playerTiles, message.data.to)
			? this._gameData.playerTiles[message.data.to]
			: undefined;
		if (!Array.isArray(recipientTiles)) {
			respond({ error: 'Invalid player!' });
			return;
		}

		const selectedTiles = recipientTiles
			.map((tid: string) => this._gameData.tiles[tid])
			.filter((t: HanabiTile) => doesHanabiTileMatchClue(t, this._gameData.ruleSet, message.data));

		if (selectedTiles.length === 0) {
			respond({ error: 'Clues must select at least 1 tile.' });
			return;
		}

		const actionType =
			message.data.color === undefined
				? HanabiGameActionType.GiveNumberClue
				: HanabiGameActionType.GiveColorClue;

		// Make sure there's a clue to spare.
		if (this._gameData.clues === 0) {
			respond({ error: 'No clues remaining.' });
			return;
		}
		const before = this._botRound?.version === 2 ? structuredClone(this._gameData) : undefined;

		// Decrement clue count.
		this._gameData.clues -= 1;

		// Record the action.
		const [clueAction] = this._appendActions({
			id: randomUUID(),
			playerId: userId,
			type: actionType,
			recipientId: message.data.to,
			color: message.data.color,
			number: message.data.number,
			tiles: selectedTiles,
		});

		// Record notes for the selected tiles.
		for (const selectedTile of selectedTiles) {
			const newTileNotes = addToTileNotes(
				this._gameData.tileNotes[selectedTile.id],
				message.data.color,
				message.data.number,
			);

			this._gameData.tileNotes = {
				...this._gameData.tileNotes,
				[selectedTile.id]: newTileNotes,
			};
		}

		this._completeTurn(userId);
		this._recordAcceptedMove(clueAction, before);

		// Send success message.
		respond({});

		// Send the updated state to all players/watchers.
		this._broadcastGameData();

		// Touch the games last updated time.
		this._update();
	}

	private _handleMoveTilesMessage(message: MoveTilesMessage, userId: string): void {
		if (!this._gameData.players[userId]) {
			this._messenger.send(userId, {
				type: 'MoveTilesResponseMessage',
				data: { error: 'Invalid player!' },
			});
			return;
		}

		if (this._gameData.stage !== HanabiStage.Playing) {
			this._messenger.send(userId, {
				type: 'MoveTilesResponseMessage',
				data: { error: "The game isn't being played right now.!" },
			});
			return;
		}
		if (!this._gameData.allowDragging) {
			this._messenger.send(userId, {
				type: 'MoveTilesResponseMessage',
				data: { error: 'Card movement is disabled for this game.' },
			});
			return;
		}

		const positions: unknown = message.data;
		if (typeof positions !== 'object' || positions === null || Array.isArray(positions)) {
			this._messenger.send(userId, {
				type: 'MoveTilesResponseMessage',
				data: { error: 'Invalid position.' },
			});
			return;
		}
		const requestedPositions = positions as Record<string, unknown>;

		// Validate that the user owns all these tiles.
		for (const tileId of Object.keys(requestedPositions)) {
			if (!this._gameData.tilePositions[tileId]) {
				this._messenger.send(userId, {
					type: 'MoveTilesResponseMessage',
					data: { error: 'Invalid tile id!' },
				});
				return;
			}

			if (!this._gameData.playerTiles[userId].includes(tileId)) {
				this._messenger.send(userId, {
					type: 'MoveTilesResponseMessage',
					data: { error: "That tile isn't in your hand!" },
				});
				return;
			}

			const position = requestedPositions[tileId];
			const candidate = position as Partial<Position> | null;

			if (
				typeof candidate !== 'object' ||
				candidate === null ||
				typeof candidate.x !== 'number' ||
				typeof candidate.y !== 'number' ||
				typeof candidate.z !== 'number' ||
				!Number.isFinite(candidate.x) ||
				!Number.isFinite(candidate.y) ||
				!Number.isFinite(candidate.z) ||
				candidate.x > HANABI_BOARD_SIZE.width - HANABI_TILE_SIZE.width ||
				candidate.y > HANABI_BOARD_SIZE.height - HANABI_TILE_SIZE.height ||
				candidate.x < 0 ||
				candidate.y < 0
			) {
				this._messenger.send(userId, {
					type: 'MoveTilesResponseMessage',
					data: { error: 'Invalid position.' },
				});
				return;
			}
		}

		// All tiles are validated. Commit the packed hand as one arrangement.
		const normalizedPositions = Object.fromEntries(
			Object.entries(requestedPositions).map(([id, value]) => {
				const { x, y, z } = value as Position;
				return [id, { x, y, z }];
			}),
		);
		const moved = this._commitArrangement(
			userId,
			packHanabiHandPositions(this._gameData.playerTiles[userId], {
				...this._gameData.tilePositions,
				...normalizedPositions,
			}),
		);
		if (moved) {
			this._recordTranscriptSnapshot();
			this._invalidateBotTurn(false);
		}

		// Send success message.
		this._messenger.send(userId, {
			type: 'MoveTilesResponseMessage',
			data: {},
		});

		// Send the updated state to all players/watchers.
		this._broadcastGameData();

		// Touch the games last updated time.
		this._update();
	}

	private _handleResetGameMessage(_message: ResetGameMessage, userId: string): void {
		if (!this._gameData.players[userId]) {
			this._messenger.send(userId, {
				type: 'ResetGameResponseMessage',
				data: { error: 'Only players can reset the game.' },
			});
			return;
		}

		if (this._transcript?.lifecycle.status === 'in_progress') {
			this._transcript = resetGameTranscript(this._transcript, new Date().toISOString());
			this._recordTranscriptSnapshot();
		}

		// Generate a new game.
		this._botCoordinator?.changed();
		this._resultCoordinator?.changed();
		this._resultTurn = null;
		this._botRound = null;
		this._gameData = generateHanabiGameData({
			creatorId: this.creatorId,
			players: this._gameData.players,
			ruleSet: this._gameData.ruleSet,
		});
		this._transcript = null;

		// Send the updated state to all players/watchers.
		this._messenger.send(userId, {
			type: 'ResetGameResponseMessage',
			data: {},
		});

		// Send the updated state to all players/watchers.
		this._broadcastGameData();

		// Touch the games last updated time.
		this._update();
	}
}
