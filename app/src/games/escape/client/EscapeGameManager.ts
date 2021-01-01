import GameManager from 'app/src/games/client/GameManager';
import {
	AddPlayerMessage,
	AddPlayerResponseMessage,
	getScope,
	GetStateMessage,
	GetStateResponseMessage,
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

	public async addPlayer(name: string): Promise<void> {
		if (!this._gameId) {
			throw new Error('Cannot add a player without a game.');
		}

		// Attempt to watch the game using the game code.
		const addPlayerMessage: AddPlayerMessage = {
			scope: getScope(this._gameId),
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
}
