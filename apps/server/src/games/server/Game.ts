import { SaveGameDelegate } from './GameStore.js';
import { generateGameCode } from './generateGameCode.js';
import { randomUUID } from 'node:crypto';
import Logger from '../../utils/Logger.js';

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
	private _saveLoop: Promise<void> | null = null;
	private _saveRequested = false;
	private _saveError: unknown = null;
	private _acceptingSaves = true;

	constructor(creatorId: string, saveGameDelegate: SaveGameDelegate) {
		this._creatorId = creatorId;
		this._saveGameDelegate = saveGameDelegate;

		this._id = randomUUID();
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
		if (!this._acceptingSaves) {
			return;
		}

		this._saveRequested = true;
		this._startSaveLoop();
	}

	private _startSaveLoop(): void {
		if (this._saveLoop) {
			return;
		}

		this._saveLoop = Promise.resolve()
			.then(async () => {
				while (this._saveRequested) {
					this._saveRequested = false;
					try {
						await this._saveGameDelegate.saveGame(this);
					} catch (error) {
						this._saveError = error;
						Logger.error(`Failed to save ${this.title} game ${this.id}.`, error);
					}
				}
			})
			.finally(() => {
				this._saveLoop = null;
				if (this._saveRequested) {
					this._startSaveLoop();
				}
			});
	}

	public async flushSaves(): Promise<void> {
		while (this._saveLoop || this._saveRequested) {
			if (!this._saveLoop) {
				this._startSaveLoop();
			}
			await this._saveLoop;
		}

		if (this._saveError) {
			const error = this._saveError;
			this._saveError = null;
			throw error instanceof Error
				? error
				: new Error('Game save failed with a non-Error value.', { cause: error });
		}
	}

	public stopSaving(): void {
		this._acceptingSaves = false;
	}

	// This game is being deleted and it should clean up all subscriptions and
	// assets. Children may override.
	public cleanUp(): void {
		// Noop.
	}
}
