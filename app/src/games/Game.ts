import { v1 as uuidv1 } from 'uuid';

const CODE_GENERATION_ALPHABET = '23456789abdegjkmnpqrvwxyz';
const CODE_GENERATION_LENGTH = 4;

export default class Game {
	private _id: string;
	get id(): string {
		return this._id;
	}

	private _code: string;
	get code(): string {
		return this._code;
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

	// This game is being deleted and it should clean up all subscriptions and
	// assets. Children may override.
	public cleanUp(): void {
		// No op.
	}
}
