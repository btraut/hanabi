export default class Game<MessageType> {
	private _created = new Date();
	get created(): Date {
		return this._created;
	}

	private _playerIds: string[] = [];
	get playerIds(): readonly string[] {
		return this._playerIds;
	}

	// Child classes can override, but should call super.
	public addPlayer(id: string): void {
		this._playerIds.push(id);
	}

	// Child classes can override, but should call super.
	public removePlayer(id: string): void {
		this._playerIds = this._playerIds.filter((player) => player !== id);
	}

	// Child classes should override.
	public handleMessage(message: MessageType, senderId: string): void {
		console.log(`${senderId} sent a message:`, message);
	}

	protected _sendMessage(_message: MessageType, _playerId: string): void {
		// send to delegate
	}

	protected _sendMessageToAllPlayers(message: MessageType): void {
		const playerIds = this._playerIds;

		for (const playerId of playerIds) {
			this._sendMessage(message, playerId);
		}
	}

	protected _sendMessageToOtherPlayers(message: MessageType, senderId: string): void {
		const playerIds = this._playerIds.filter((id) => id !== senderId);

		for (const playerId of playerIds) {
			this._sendMessage(message, playerId);
		}
	}
}
