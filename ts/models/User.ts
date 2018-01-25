export enum UserType {
	Host,
	Player,
	Unknown
}

export class User {
	public get id() { return this._id; }
	public get type() { return this._type; }
	public get created() { return this._created; }
	public get updated() { return this._updated; }
	
	public get isConnected() { return this._isConnected; }
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
	
	public ping() {
		this._updated = new Date();
	}
}
