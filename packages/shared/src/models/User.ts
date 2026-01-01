export enum UserType {
	Host,
	Player,
	Unknown,
}

export class User {
	public get id(): string {
		return this._id;
	}
	public get type(): UserType {
		return this._type;
	}
	public get created(): Date {
		return this._created;
	}
	public get updated(): Date {
		return this._updated;
	}

	public get isConnected(): boolean {
		return this._isConnected;
	}
	public set isConnected(val: boolean) {
		this._isConnected = val;
		this._updated = new Date();
	}

	private _id: string;
	private _type: UserType;
	private _created = new Date();
	private _updated = new Date();
	private _isConnected = true;

	constructor(id: string, type: UserType) {
		this._id = id;
		this._type = type;
	}

	public ping(): void {
		this._updated = new Date();
	}
}
