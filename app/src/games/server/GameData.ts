export interface SerialGameData {
	id: string;
	code: string;
}

export default class GameData {
	public id = '';
	public code = '';

	public serialize(): SerialGameData {
		return {
			id: this.id,
			code: this.code,
		};
	}
}
