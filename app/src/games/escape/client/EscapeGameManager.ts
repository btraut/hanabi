import GameManager from 'app/src/games/client/GameManager';
import { ESCAPE_GAME_TITLE } from 'app/src/games/escape/server/EscapeGame';
import PubSub from 'app/src/utils/PubSub';

export enum EscapeGameStage {
	Lobby,
	PlayerSetup,
	InGame,
}

export default class EscapeGameManager extends GameManager {
	public onUpdate = new PubSub<void>();

	private _gameId: string | null = null;
	public get gameId(): string | null {
		return this._gameId;
	}

	private _stage: EscapeGameStage = EscapeGameStage.Lobby;
	public get stage(): EscapeGameStage {
		return this._stage;
	}

	public async host(): Promise<void> {
		this._gameId = await this._createGame(ESCAPE_GAME_TITLE);
		this._stage = EscapeGameStage.PlayerSetup;

		this.onUpdate.emit();
	}

	public async leaveGame(): Promise<void> {
		this._gameId = null;

		this._stage = EscapeGameStage.Lobby;

		this.onUpdate.emit();
	}
}
