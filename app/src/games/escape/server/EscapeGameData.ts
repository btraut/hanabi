import EscapeGamePlayer from 'app/src/games/escape/EscapeGamePlayer';
import GameData, { SerialGameData } from 'app/src/games/server/GameData';

export interface SerialEscapeGameData extends SerialGameData {
	map: string[][][];
	players: { [id: string]: EscapeGamePlayer };
}

export default class EscapeGameData extends GameData {
	public id = '';
	public code = '';
	public map: string[][][] = [];
	public players: { [id: string]: EscapeGamePlayer } = {};

	public serialize(): SerialEscapeGameData {
		return {
			id: this.id,
			code: this.code,
			map: this.map,
			players: this.players,
		};
	}
}
