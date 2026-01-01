import { SaveGameDelegate } from './GameStore.js';
import { generateGameCode } from './generateGameCode.js';
import { v4 as uuidv4 } from 'uuid';

export interface GameSerialized {
	id: string;
	code: string;
	creatorId: string;
	created: string;
	updated: string;
}

export default class Game {
	get title(): string {
		throw new Error('Subclasses must override.');
	}

	protected _id: string;
	get id(): string {
		return this._id;
	}

	protected _code: string;
	get code(): string {
		return this._code;
	}

	protected _creatorId: string;
	get creatorId(): string {
		return this._creatorId;
	}

	protected _watchers: string[] = [];
	get watchers(): string[] {
		return this._watchers;
	}

	protected _created = new Date();
	get created(): Date {
		return this._created;
	}

	protected _updated = new Date();
	get updated(): Date {
		return this._updated;
	}

	protected _saveGameDelegate: SaveGameDelegate;

	constructor(creatorId: string, saveGameDelegate: SaveGameDelegate) {
		this._creatorId = creatorId;
		this._saveGameDelegate = saveGameDelegate;

		this._id = uuidv4();
		this._code = generateGameCode();
	}

	// Serialize game data for writing offline. Return null if you game doesn't
	// support.
	public serialize(): string | null {
		return null;
	}

	protected _getBaseData(): GameSerialized {
		return {
			id: this._id,
			code: this._code,
			creatorId: this._creatorId,
			created: this._created.toJSON(),
			updated: this._updated.toJSON(),
		};
	}

	// Subclasses should call this method whenever data or state changes.
	protected _update(): void {
		this._updated = new Date();
		this._saveGameDelegate.saveGame(this);
	}

	// This game is being deleted and it should clean up all subscriptions and
	// assets. Children may override.
	public cleanUp(): void {
		// Noop.
	}
}
