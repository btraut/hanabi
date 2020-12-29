import { v1 as uuidv1 } from 'uuid';

export default class Game {
	private _id = uuidv1();
	get id(): string {
		return this._id;
	}

	private _created = new Date();
	get created(): Date {
		return this._created;
	}

	// This game is being deleted and it should clean up all subscriptions and
	// assets. Children should override.
	public cleanUp(): void {
		// No op.
	}
}
