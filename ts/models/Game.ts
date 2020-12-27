import Player from './Player';

const CODE_GENERATION_ALPHABET = '23456789abdegjkmnpqrvwxyz';
const CODE_GENERATION_LENGTH = 4;

export enum ConnectionState {
	Disconnected,
	LoadingInitialData,
	Connected
}

export enum GameState {
	WaitingForPlayers,
	WaitingForPhraseSubmissions,
	WaitingForPictureSubmissions,
	AllSubmissionsRecieved,
	WaitingToReviewStories,
	ReviewingStories,
	PlayAgainOptions
}

export interface GameData {
	readonly code: string;
	readonly state: GameState;
	readonly host: Player;
	readonly players: Player[];
	readonly currentRound: number;
	readonly presentingPlayer: number;
	readonly presentingRound: number;
	readonly rounds: number;
	readonly phrases: Array<{ [playerId: string]: string }>;
	readonly pictures: Array<{ [playerId: string]: string }>;
}

export class Game {
	public get created() { return this._created; }
	public get updated() { return this._updated; }
	public get host() { return this._host; }
	public get players() { return this._players; }
	public get phrases() { return this._phrases; }
	public get pictures() { return this._pictures; }
	public get code() { return this._code; }
	public get currentRound() { return this._currentRound; }
	public get presentingPlayer() { return this._presentingPlayer; }
	public get presentingRound() { return this._presentingRound; }
	public get rounds() { return this._rounds; }
	public get state() { return this._state; }
	public get allUsers() { return [...Object.values(this._players).map(p => p.id), this._host.id]; }
	
	private _created = new Date();
	private _updated = new Date();
	private _players: { [playerId: string]: Player } = {};
	private _phrases: Array<{ [playerId: string]: string }> = [];
	private _pictures: Array<{ [playerId: string]: string }> = [];
	private _host: Player;
	private _currentRound: number = 0;
	private _presentingPlayer: number = 0;
	private _presentingRound: number = 0;
	private _rounds: number = 5;
	private _code: string = this.regenerateCode();
	private _state = GameState.WaitingForPlayers;
	
	constructor(hostId: string) {
		this._host = {
			name: 'host',
			id: hostId,
			connected: true
		};
	}
	
	public toObject(): GameData {
		return {
			code: this._code,
			state: this._state,
			host: this._host,
			players: Object.values(this._players),
			currentRound: this._currentRound,
			presentingPlayer: this._presentingPlayer,
			presentingRound: this._presentingRound,
			rounds: this._rounds,
			phrases: this._phrases,
			pictures: this._pictures
		};
	}
	
	public regenerateCode() {
		let code = '';
		
		for (let i = 0; i < CODE_GENERATION_LENGTH; i += 1) {
			code += CODE_GENERATION_ALPHABET.charAt(Math.floor(Math.random() * CODE_GENERATION_ALPHABET.length));
		}
		
		this._code = code;
		return this._code;
	}
	
	public addPlayer(playerId: string, name = '') {
		if (!this._players[playerId]) {
			this._players[playerId] = {
				id: playerId,
				name,
				connected: true
			};
		}
		
		this._updated = new Date();
		
		return this._players[playerId];
	}
	
	public validateName(name: string) {
		if (name === '') {
			return 'Names can’t be blank.';
		}
		
		if (name.length > 20) {
			return 'Try a shorter name.';
		}
		
		for (const player of Object.values(this._players)) {
			if (name === player.name) {
				return `Someone already snagged the name "${name}". Try another one.`;
			}
		}
		
		return null;
	}
	
	public validatePhrase(phrase: string) {
		if (phrase === '') {
			return 'Phrases can’t be blank.';
		}
		
		if (phrase.length === 0) {
			return 'Try a longer phrase.';
		}
		
		if (phrase.length > 100) {
			return 'Try a shorter phrase.';
		}
		
		return null;
	}
	
	public updatePlayer(playerId: string, updates: Partial<Player>) {
		const updatedPlayer = this._players[playerId] as Player | undefined;
		if (updatedPlayer) {
			this._players[playerId] = { ...updatedPlayer, ...updates };
		}
		
		this._updated = new Date();
		
		return this._players[playerId];
	}
	
	public updateHost(updates: Partial<Player>) {
		this._host = { ...this._host, ...updates };
		
		this._updated = new Date();
		
		return this._host;
	}
	
	public start() {
		this.moveToState(GameState.WaitingForPhraseSubmissions, 0);
	}
	
	public shufflePlayerOrders() {
		const orders = [];
		const playerIds = Object.keys(this._players);
		
		for (let i = 0; i < playerIds.length; i += 1) {
			orders.push(i);
		}
		
		for (let i = orders.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[orders[i], orders[j]] = [orders[j], orders[i]];
		}

		for (let i = 0; i < playerIds.length; i += 1) {
			this._players[playerIds[i]].order = orders[i];
		}
	}
	
	public moveToState(state: GameState, round: number) {
		this._state = state;
		this._currentRound = round;
		this._updated = new Date();
	}
	
	public enterPhrase(playerId: string, round: number, phrase: string) {
		const index = round / 2;
		if (!this._phrases[index]) {
			this._phrases[index] = {};
		}
		this._phrases[index][playerId] = phrase;

		this._updated = new Date();
	}
	
	public enterPicture(playerId: string, round: number, pictureData: string) {
		const index = (round - 1) / 2;
		if (!this._pictures[index]) {
			this._pictures[index] = {};
		}
		this._pictures[index][playerId] = pictureData;
		
		this._updated = new Date();
	}
	
	public advanceStoryReview() {
		if (this._state === GameState.WaitingToReviewStories) {
			this._state = GameState.ReviewingStories;
		} else if (this._state === GameState.ReviewingStories) {
			if (this._presentingRound === this._rounds - 1) {
				if (this._presentingPlayer === Object.keys(this._players).length - 1) {
					this._presentingPlayer = 0;
					this._presentingRound = 0;
					this._state = GameState.PlayAgainOptions;
				} else {
					this._presentingPlayer += 1;
					this._presentingRound = 0;
					this._state = GameState.WaitingToReviewStories;
				}
			} else {
				this._presentingRound += 1;
			}
		} else {
			return;
		}
		
		this._updated = new Date();
	}
	
	public startOver() {
		const newGame = new Game(this._host.id);
		
		newGame._host = this._host;
		newGame._players = this._players;
		newGame._state = GameState.WaitingForPhraseSubmissions;
		newGame._currentRound = 0;
		newGame._presentingPlayer = 0;
		newGame._presentingRound = 0;
		newGame._rounds = this._rounds;
		
		return newGame;
	}
}
