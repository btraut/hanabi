import { v1 as uuidv1 } from 'uuid';

export default class Game {
	private _id = uuidv1();
	get id(): string {
		return this._id;
	}

	private _creatorId: string;
	get creatorId(): string {
		return this._creatorId;
	}

	private _created = new Date();
	get created(): Date {
		return this._created;
	}

	private _updated = new Date();
	get updated(): Date {
		return this._updated;
	}
	protected _update(): void {
		this._updated = new Date();
	}

	constructor(creatorId: string) {
		this._creatorId = creatorId;
	}

	// This game is being deleted and it should clean up all subscriptions and
	// assets. Children should override.
	public cleanUp(): void {
		// No op.
	}
}
