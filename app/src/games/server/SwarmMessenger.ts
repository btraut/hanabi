// What is this? It's my attempt at the server component of Swarm. Like
// GameMessenger, it's an addon to games that adds the functionality of
// socket message handling, but this one is specific to Swarm messages. I never tested this, so it probably doesn't work.

/*
import { AddPeerMessage, SignalMessage, SwarmMessage } from 'app/src/games/SwarmMessages';
import SocketManager from 'app/src/utils/server/SocketManager';

export default class SwarmMessenger {
	private _scope: string;
	private _socketManager: SocketManager<SwarmMessage>;
	private _socketManagerOnMessageSubscriptionId: number;

	public peerIds: readonly string[] = [];

	constructor(socketManager: SocketManager<SwarmMessage>, scope: string) {
		this._scope = scope;
		this._socketManager = socketManager;
	}

	public connect(): void {
		this._socketManagerOnMessageSubscriptionId = this._socketManager.addScopedMessageHandler(
			this._handleMessage,
			this._scope,
		);
	}

	public disconnect(): void {
		this._socketManager.onMessage.unsubscribe(this._socketManagerOnMessageSubscriptionId);
	}

	private _handleMessage = ({ userId, message }: { userId: string; message: SwarmMessage }) => {
		switch (message.type) {
			case 'AddPeerMessage':
				this._handleAddPeerMessage(message, userId);
				break;
			case 'SignalMessage':
				this._handleSignalMessage(message, userId);
				break;
		}
	};

	private _handleAddPeerMessage(_message: AddPeerMessage, userId: string) {
		if (!this.peerIds.includes(userId)) {
			throw new Error('Invalid user id attempting to broadcast.');
		}

		const otherUsersIds = this.peerIds.filter((id) => id !== userId);

		for (const recipientId of otherUsersIds) {
			this._socketManager.send(recipientId, {
				scope: this._scope,
				type: 'AddPeerMessage',
				data: { userId },
			});
		}
	}

	private _handleSignalMessage(message: SignalMessage, userId: string) {}

	public send(userIdOrIds: string | readonly string[], message: SwarmMessage): void {
		this._socketManager.send(userIdOrIds, message);
	}
}
*/
