import GameManager from 'app/src/games/client/GameManager';
import {
	getScope,
	GetStateMessage,
	GetStateResponseMessage,
	JoinGameMessage,
	JoinGameResponseMessage,
} from 'app/src/games/escape/EscapeGameMessages';
import { ESCAPE_GAME_TITLE } from 'app/src/games/escape/server/EscapeGame';
import { SerialEscapeGameData } from 'app/src/games/escape/server/EscapeGameData';
import {
	GAME_MANAGER_SCOPE,
	GetGameFromCodeMessage,
	GetGameFromCodeResponseMessage,
} from 'app/src/games/GameManagerMessages';

export default class EscapeGameManager extends GameManager {
	// Children must override.
	protected get _title(): string {
		return ESCAPE_GAME_TITLE;
	}

	protected _gameData: SerialEscapeGameData | null = null;
	public get gameData(): SerialEscapeGameData | null {
		return this._gameData;
	}

	public async join(code: string, name: string): Promise<void> {
		// Convert the game code to a game id.
		const getGameFromCodeMessage: GetGameFromCodeMessage = {
			scope: GAME_MANAGER_SCOPE,
			type: 'GetGameFromCodeMessage',
			data: { code },
		};
		this._socketManager.send(getGameFromCodeMessage);
		const getGameFromCodeResponseMessage = await this._socketManager.expectMessageOfType<GetGameFromCodeResponseMessage>(
			'GetGameFromCodeResponseMessage',
		);

		if (getGameFromCodeResponseMessage.data.error) {
			throw new Error(getGameFromCodeResponseMessage.data.error);
		}

		const gameId = getGameFromCodeResponseMessage.data.id!;

		// Attempt to join the game using the game id.
		const joinGameMessage: JoinGameMessage = {
			scope: getScope(gameId),
			type: 'JoinGameMessage',
			data: { name },
		};
		this._socketManager.send(joinGameMessage);

		const joinGameResponseMessage = await this._socketManager.expectMessageOfType<JoinGameResponseMessage>(
			'JoinGameResponseMessage',
		);

		if (joinGameResponseMessage.data.error) {
			throw new Error(joinGameResponseMessage.data.error);
		}

		// We've successfully joined! Save the id.
		this._gameId = gameId;

		// Fetch game state. This will trigger an update.
		await this.refreshState();
	}

	public async refreshState(): Promise<void> {
		if (!this._gameId) {
			throw new Error('Game must be started/loaded first.');
		}

		const getStateMessage: GetStateMessage = {
			scope: getScope(this._gameId),
			type: 'GetStateMessage',
			data: undefined,
		};
		this._socketManager.send(getStateMessage);

		const getStateResponseMessage = await this._socketManager.expectMessageOfType<GetStateResponseMessage>(
			'GetStateResponseMessage',
		);

		this._gameData = getStateResponseMessage.data.state;

		this.onUpdate.emit();
	}

	public async leave(): Promise<void> {
		this._gameId = null;

		// TODO: send message

		this.onUpdate.emit();
	}
}
