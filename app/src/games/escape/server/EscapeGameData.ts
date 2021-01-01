import EscapeGamePlayer from 'app/src/games/escape/EscapeGamePlayer';
import EscapeGameStage from 'app/src/games/escape/EscapeGameStage';
import GameData, { SerialGameData } from 'app/src/games/server/GameData';

export interface SerialEscapeGameData extends SerialGameData {
	stage: EscapeGameStage;
	map: string[][][];
	players: { [id: string]: EscapeGamePlayer };
}

export default class EscapeGameData extends GameData {
	public id = '';
	public code = '';
	public stage = EscapeGameStage.Open;
	public map: string[][][] = [];
	public players: { [id: string]: EscapeGamePlayer } = {};

	public serialize(): SerialEscapeGameData {
		return {
			id: this.id,
			code: this.code,
			stage: this.stage,
			map: this.map,
			players: this.players,
		};
	}
}
