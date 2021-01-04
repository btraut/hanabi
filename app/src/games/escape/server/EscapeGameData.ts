import EscapePlayer from 'app/src/games/escape/EscapePlayer';
import EscapeStage from 'app/src/games/escape/EscapeStage';

export interface SerialEscapeGameData {
	stage: EscapeStage;
	players: { [id: string]: EscapePlayer };
}

export const emptyEscapeGameData: SerialEscapeGameData = {
	stage: EscapeStage.Open,
	players: {},
};

export default class EscapeGameData {
	public stage = EscapeStage.Open;
	public map: string[][][] = [];
	public players: { [id: string]: EscapePlayer } = {};

	public serialize(): SerialEscapeGameData {
		return {
			stage: this.stage,
			players: this.players,
		};
	}
}
