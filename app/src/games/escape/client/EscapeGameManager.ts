import GameManager from 'app/src/games/client/GameManager';
import {
	AddPlayerMessage,
	AddPlayerResponseMessage,
	GetGameDataMessage,
	GetGameDataResponseMessage,
	getScope,
} from 'app/src/games/escape/EscapeGameMessages';
import { ESCAPE_GAME_TITLE } from 'app/src/games/escape/server/EscapeGame';
import { SerialEscapeGameData } from 'app/src/games/escape/server/EscapeGameData';

export default class EscapeGameManager extends GameManager {
	// Children must override.
	protected get _title(): string {
		return ESCAPE_GAME_TITLE;
	}

	protected _gameData: SerialEscapeGameData | null = null;
	public get gameData(): SerialEscapeGameData | null {
		return this._gameData;
	}

	public async addPlayer(name: string): Promise<void> {
		if (!this._gameId) {
			throw new Error('Cannot add a player without a game.');
		}

		// Attempt to watch the game using the game code.
		const addPlayerMessage: AddPlayerMessage = {
			scope: getScope(this._title, this._gameId),
			type: 'AddPlayerMessage',
			data: { name },
		};
		this._socketManager.send(addPlayerMessage);

		const addPlayerResponseMessage = await this._socketManager.expectMessageOfType<AddPlayerResponseMessage>(
			'AddPlayerResponseMessage',
		);

		if (addPlayerResponseMessage.data.error) {
			throw new Error(addPlayerResponseMessage.data.error);
		}

		this.onUpdate.emit();
	}

	public async refreshGameData(): Promise<void> {
		if (!this._gameId) {
			throw new Error('Game must be started/loaded first.');
		}

		const getGameDataMessage: GetGameDataMessage = {
			scope: getScope(this._title, this._gameId),
			type: 'GetGameDataMessage',
			data: undefined,
		};
		this._socketManager.send(getGameDataMessage);

		const getStateResponseMessage = await this._socketManager.expectMessageOfType<GetGameDataResponseMessage>(
			'GetGameDataResponseMessage',
		);

		this._gameData = getStateResponseMessage.data;

		this.onUpdate.emit();
	}
}
