import EscapeGamePlayer from 'app/src/games/escape/EscapeGamePlayer';
import EscapeGameStage from 'app/src/games/escape/EscapeGameStage';

export interface SerialEscapeGameData {
	stage: EscapeGameStage;
	players: { [id: string]: EscapeGamePlayer };
}

export const emptyEscapeGameData: SerialEscapeGameData = {
	stage: EscapeGameStage.Open,
	players: {},
};

export default class EscapeGameData {
	public stage = EscapeGameStage.Open;
	public map: string[][][] = [];
	public players: { [id: string]: EscapeGamePlayer } = {};

	public serialize(): SerialEscapeGameData {
		return {
			stage: this.stage,
			players: this.players,
		};
	}
}
