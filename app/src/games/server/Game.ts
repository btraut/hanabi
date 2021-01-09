import { SaveGameDelegate } from 'app/src/games/server/SaveGameDelegate';
import { v1 as uuidv1 } from 'uuid';

const CODE_GENERATION_ALPHABET = '23456789abdegjkmnpqrvwxyz';
const CODE_GENERATION_LENGTH = 4;

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

	public saveGameDelegate: SaveGameDelegate | null = null;

	constructor(creatorId: string) {
		this._creatorId = creatorId;

		this._id = uuidv1();
		this._code = this._generateCode();
	}

	private _generateCode(length = CODE_GENERATION_LENGTH) {
		let code = '';

		for (let i = 0; i < length; i += 1) {
			code += CODE_GENERATION_ALPHABET.charAt(
				Math.floor(Math.random() * CODE_GENERATION_ALPHABET.length),
			);
		}

		this._code = code;
		return this._code;
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

		if (this.saveGameDelegate) {
			this.saveGameDelegate.saveGame(this);
		}
	}

	// This game is being deleted and it should clean up all subscriptions and
	// assets. Children may override but should call super.
	public cleanUp(): void {
		this.saveGameDelegate = null;
	}
}
