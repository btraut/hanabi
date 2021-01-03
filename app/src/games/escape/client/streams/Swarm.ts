// What is this? This is my partial attempt at a webrtc-swarm rewrite using
// SocketManager as the negotiator instead of signalhub.
//
// State: This is not complete! At least, I don't think so. I never tested it. I
// also don't think I understand webrtc or SimplePeer.

/*
import { AddPeerMessage, SignalMessage, SwarmMessage } from 'app/src/games/SwarmMessages';
import SocketManager from 'app/src/utils/client/SocketManager';
import PubSub from 'app/src/utils/PubSub';
import { SignalData, SimplePeer } from 'simple-peer';

export default class Swarm {
	private _socketManager: SocketManager<SwarmMessage>;
	private _socketManagerOnMessageSubscriptionId: number | null = null;
	private _scope: string;

	private _onConnect = new PubSub<{ peer: SimplePeer; userId: string }>();
	public get onConnect(): PubSub<{ peer: SimplePeer; userId: string }> {
		return this._onConnect;
	}

	private _onDisconnect = new PubSub<{ peer: SimplePeer; userId: string }>();
	public get onDisconnect(): PubSub<{ peer: SimplePeer; userId: string }> {
		return this._onDisconnect;
	}

	private _remotes: { [userId: string]: SimplePeer };
	private _peers: { [userId: string]: SimplePeer };
	public get peers(): { [userId: string]: SimplePeer } {
		return this._peers;
	}

	constructor(socketManager: SocketManager<SwarmMessage>, scope: string) {
		this._socketManager = socketManager;
		this._scope = scope;
	}

	public connect(): void {
		// Make sure the socket is already authenticated.
		if (!this._socketManager.userId) {
			throw new Error('Must have authenticated socket.');
		}

		// Connect to the socket manager.
		this._socketManagerOnMessageSubscriptionId = this._socketManager.addScopedMessageHandler(
			this._handleMessage,
			this._scope,
		);

		// Broadcast to all peers that we're streaming.
		this._socketManager.send({
			scope: this._scope,
			type: 'AddPeerMessage',
			data: { userId: this._socketManager.userId },
		});

		// TODO: broadcast on an interval?
	}

	public disconnect(): void {
		// Iterate over each peer and disconnect.
		for (const peer of Object.values(this._peers)) {
			peer.destroy();
		}

		this._remotes = {};
		this._peers = {};

		// Disconnect from the socket manager.
		if (this._socketManagerOnMessageSubscriptionId !== null) {
			this._socketManager.onMessage.unsubscribe(this._socketManagerOnMessageSubscriptionId);
		}
	}

	private _handleMessage(message: SwarmMessage) {
		switch (message.type) {
			case 'AddPeerMessage':
				this._handleAddPeerMessage(message);
				break;
			case 'SignalMessage':
				this._handleSignalMessage(message);
				break;
		}
	}

	private _handleAddPeerMessage({ data: { userId } }: AddPeerMessage) {
		// Ignore if we already know about this user.
		if (this._remotes[userId]) {
			return;
		}

		const peer = new SimplePeer({ initiator: true });

		this._subscribeToPeerEvents(userId, this._remotes[userId]);
		this._remotes[userId] = peer;
	}

	private _handleSignalMessage({ data: { from, signal } }: SignalMessage) {
		// Ensure we have a peer created.
		if (!this._remotes[from]) {
			this._remotes[from] = new SimplePeer();
			this._subscribeToPeerEvents(from, this._remotes[from]);
		}

		const peer = this._remotes[from];

		peer.signal(signal);
	}

	private _subscribeToPeerEvents(userId: string, peer: SimplePeer) {
		peer.on('signal', (signal: string | SignalData) => {
			this._socketManager.send({
				scope: this._scope,
				type: 'SignalMessage',
				data: { to: userId, from: this._socketManager.userId!, signal },
			});
		});
		peer.on('connect', () => {
			this._peers[userId] = peer;
			this._onConnect.emit({ userId, peer });
		});
		peer.on('close', () => {
			delete this._peers[userId];
			delete this._remotes[userId];
			this._onDisconnect.emit({ userId, peer });
		});
	}
}
*/
