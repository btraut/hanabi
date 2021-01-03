// What is this? Before I realized that signalhub (and webrtc-swarm) were
// horribly old and unbuildable, I built this to connect with the rest of the
// app. This was used in conjunction with useSignalHubManager. This should
// probably just be deleted.

/*
import { StreamConnection } from 'app/src/games/escape/client/streams/Stream';
import PubSub from 'app/src/utils/PubSub';
import signalhub from 'signalhub';
import swarm from 'webrtc-swarm';

interface SignalhubMessage {
	type: string;
	from: string;
}

declare const SIGNALHUB_URL: string;

const CONNECTION_TIMEOUT = 20000;

export default class SignalHubManager {
	private _userId: string;
	private _stream: MediaStream | null;
	private _audioOn: boolean;
	private _videoOn: boolean;

	private _hub: any = null;
	private _swarm: any = null;

	private _hubId: string;
	public get hubId(): string {
		return this._hubId;
	}

	private _connectingPeers: { [id: string]: ReturnType<typeof setTimeout> };

	private _peers: { [id: string]: any };
	private _peerStreams: { [id: string]: StreamConnection };
	public get peerStreams(): Readonly<{ [id: string]: StreamConnection }> {
		return this._peerStreams;
	}

	private _swarmInitialized = false;
	public get swarmInitialized(): boolean {
		return this._swarmInitialized;
	}

	private _onUpdate = new PubSub<void>();
	public get onUpdate(): PubSub<void> {
		return this._onUpdate;
	}

	constructor(hubId: string) {
		this._hubId = hubId;
	}

	public connect({
		userId,
		stream,
		audioOn,
		videoOn,
	}: {
		userId: string;
		stream: MediaStream | null;
		audioOn: boolean;
		videoOn: boolean;
	}): void {
		this._userId = userId;
		this._stream = stream;
		this._audioOn = audioOn;
		this._videoOn = videoOn;

		// Create a hub.
		this._hub = signalhub(this._hubId, [SIGNALHUB_URL]);

		this._hub.subscribe('all').on('data', this._handleHubData);

		// Create a swarm using the hub as the discovery/connection broker.
		this._swarm = swarm(this._hub, {
			config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] },
			uuid: this._userId,
			wrap: (outgoingSignalingData: any) => ({
				...outgoingSignalingData,
				from: userId,
			}),
		});

		this._swarm.on('connect', this._handleConnect);
		this._swarm.on('disconnect', this._handleDisconnect);

		// Send initial connect signal.
		this._hub.broadcast(this._hubId, {
			type: 'connect',
			from: this._userId,
		} as SignalhubMessage);
	}

	public cleanUp(): void {
		this._peers = {};
		this._peerStreams = {};

		this._swarm.close();
		this._swarm = null;

		this._hub.close();
		this._hub = null;

		this._onUpdate.unsubscribeAll();
	}

	private _handleHubData = (message: SignalhubMessage) => {
		if (!this._swarmInitialized) {
			this._swarmInitialized = true;
			this.onUpdate.emit();
		}

		// Ignore self-sent messages.
		if (message.from === this._userId) {
			return;
		}

		// Listen for peer connections.
		if (message.type === 'connect') {
			if (!this._peerStreams[message.from]) {
				console.info('connecting to', { uuid: message.from });

				this._connectingPeers[message.from] = setTimeout(() => {
					console.log('Connection timed out.');
					delete this._connectingPeers[message.from];
				}, CONNECTION_TIMEOUT);
			}
		}
	};

	private _handleConnect = (peer: any, id: string) => {
		console.info('connected to a new peer:', { id, peer });

		peer.on('stream', (stream: MediaStream) => {
			console.info('received stream', stream);
			this._peerStreams[id].stream = stream;
		});

		peer.on('data', (payload: any) => {
			const data = JSON.parse(payload.toString());

			console.info('received data', { id, data });

			// Peer got our handshake and responded. Send them our stream.
			if (data.type === 'receivedHandshake') {
				if (this._stream) {
					peer.addStream(this._stream);
				}

				if (!this._audioOn) {
					peer.send(JSON.stringify({ type: 'audioToggle', enabled: false }));
				}

				if (!this._videoOn) {
					peer.send(JSON.stringify({ type: 'videoToggle', enabled: false }));
				}
			}

			// Peer sent us a handshake. Add them to our peer list.
			if (data.type === 'sendHandshake') {
				if (!this._connectingPeers[id]) {
					console.error('Not expecting handshake.');
					return;
				}

				clearTimeout(this._connectingPeers[id]);
				delete this._connectingPeers[id];

				this._peers[id] = peer;
				this._peerStreams[id] = {
					stream: null,
					audioEnabled: true,
					videoEnabled: true,
					audioOn: true,
					videoOn: true,
				};

				this._onUpdate.emit();
			}

			// Peer toggled audio.
			if (data.type === 'audioToggle') {
				if (!this._peerStreams[id]) {
					console.error('Cannot toggle audio before handshaking.');
					return;
				}

				this._peerStreams[id].audioOn = data.enabled;

				this._onUpdate.emit();
			}

			// Peer toggled video.
			if (data.type === 'videoToggle') {
				if (!this._peerStreams[id]) {
					console.error('Cannot toggle video before handshaking.');
					return;
				}

				this._peerStreams[id].videoOn = data.enabled;

				this._onUpdate.emit();
			}
		});

		peer.send(JSON.stringify({ type: 'sendHandshake' }));
	};

	private _handleDisconnect = (_peer: any, id: string) => {
		console.info('disconnected from a peer:', id);

		if (this._peers[id] || this._peerStreams[id]) {
			delete this._peers[id];
			delete this._peerStreams[id];

			this._onUpdate.emit();
		}
	};

	public get videoOn(): boolean {
		return this._videoOn;
	}
	public set videoOn(videoOn: boolean) {
		if (!this._videoOn === videoOn) {
			return;
		}

		this._videoOn = videoOn;

		for (const peer of Object.values(this._peers)) {
			peer.send(JSON.stringify({ type: 'videoToggle', enabled: !videoOn }));
		}

		this._onUpdate.emit();
	}

	public get audioOn(): boolean {
		return this._audioOn;
	}
	public set audioOn(audioOn: boolean) {
		if (!this._audioOn === audioOn) {
			return;
		}

		this._audioOn = audioOn;

		for (const peer of Object.values(this._peers)) {
			peer.send(JSON.stringify({ type: 'audioToggle', enabled: !audioOn }));
		}

		this._onUpdate.emit();
	}
}
*/
