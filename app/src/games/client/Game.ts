// TODO: Kill this file.

export default class Game {
	protected _id: string;
	public get id(): string {
		return this._id;
	}

	protected _code: string;
	public get code(): string {
		return this._code;
	}

	constructor(id: string, code: string) {
		this._id = id;
		this._code = code;
	}
}
