import { Server as HTTPServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { v1 as uuidv1 } from 'uuid';

import { SocketMessageBase } from '../models/SocketMessage';
import Logger from '../utils/Logger';
import PubSub from './PubSub';

interface AuthToken {
	created: Date;
	userId: string;
	token: string;
}

// TODO
type AuthenticateSocketMessage = any;
type AuthenticateResponseSocketMessage = any;

const TOKEN_EXPIRATION_MINUTES = 5;

export default class ServerSocketManager<SocketMessageType extends SocketMessageBase> {
	private _server: SocketServer;

	private _authenticatedUsers: { [socketId: string]: string } = {};
	private _tokens: { [token: string]: AuthToken } = {};

	public _onConnect = new PubSub<{ userId: string }>();
	public _onDisconnect = new PubSub<{ userId: string }>();
	public _onMessage = new PubSub<{ userId: string; message: SocketMessageType }>();

	public get onConnect(): PubSub<{ userId: string }> {
		return this._onConnect;
	}
	public get onDisconnect(): PubSub<{ userId: string }> {
		return this._onDisconnect;
	}
	public get onMessage(): PubSub<{ userId: string; message: SocketMessageType }> {
		return this._onMessage;
	}

	constructor(httpServer: HTTPServer) {
		this._server = new SocketServer(httpServer);

		setInterval(this._purgeTokens, TOKEN_EXPIRATION_MINUTES * 60 * 1000);
	}

	public start(): void {
		this._server.on('connection', (connection) => {
			this._handleConnect(connection.id);

			connection.on('message', (data: SocketMessageType) => {
				this._handleMessage(connection.id, data);
			});

			connection.on('disconnect', () => {
				this._handleDisconnect(connection.id);
			});
		});
	}

	public addTokenForUser(userId: string): string {
		const token = uuidv1().substr(0, 6);
		this._tokens[token] = { token, userId, created: new Date() };
		return token;
	}

	private _purgeTokens = () => {
		const oldestTime = new Date(new Date().getTime() - TOKEN_EXPIRATION_MINUTES * 60 * 1000);

		for (const token of Object.keys(this._tokens)) {
			if (this._tokens[token].created < oldestTime) {
				delete this._tokens[token];
				Logger.debug(`Purged token "${token}" from ServerSocketManager.`);
			}
		}
	};

	private _handleConnect = (socketId: string) => {
		Logger.debug(`socket.io connected: ${socketId}`);
	};

	private _handleDisconnect = (socketId: string) => {
		Logger.debug(`socket.io disconnected: ${socketId}`);

		// Remove the user from our authenticated list.
		const userId = this._authenticatedUsers[socketId];
		delete this._authenticatedUsers[socketId];

		this._onDisconnect.emit({ userId });
	};

	private _handleMessage = (socketId: string, message: SocketMessageType) => {
		Logger.debug('socket.io data recieved:', message);

		if (message.type === 'AuthenticateSocketMessage') {
			this._handleAuthenticateMessage(socketId, message);
		} else {
			if (this._authenticatedUsers[socketId]) {
				this._onMessage.emit({ userId: this._authenticatedUsers[socketId], message });
			}
		}
	};

	private _handleAuthenticateMessage(socketId: string, message: AuthenticateSocketMessage) {
		const token = message.data;

		if (this._tokens[token]) {
			const userId = this._tokens[token].userId;
			delete this._tokens[token];
			this._authenticatedUsers[socketId] = userId;
			this._onConnect.emit({ userId });

			const authenticateResponseSocketMessage: AuthenticateResponseSocketMessage = {
				type: 'AuthenticateResponseSocketMessage',
				data: {},
			};
			this._send(socketId, authenticateResponseSocketMessage);
		} else {
			const authenticateResponseSocketMessage: AuthenticateResponseSocketMessage = {
				type: 'AuthenticateResponseSocketMessage',
				data: {
					error: 'Invalid auth token',
				},
			};
			this._send(socketId, authenticateResponseSocketMessage);
		}
	}

	private _send(socketId: string, message: Partial<SocketMessageType>) {
		const blankMessage = { type: '', data: {} };
		this._server!.to(socketId).emit('message', { ...blankMessage, ...message });
	}

	public send(idOrIds: string | readonly string[], message: SocketMessageType): void {
		const userIds = typeof idOrIds === 'string' ? [idOrIds] : idOrIds;

		const authenticatedSockets = Object.keys(this._authenticatedUsers).reduce<{
			[userId: string]: string;
		}>((sockets, socketId) => {
			const userId = this._authenticatedUsers[socketId];
			sockets[userId] = socketId;
			return sockets;
		}, {});

		for (const userId of userIds) {
			const socketId = authenticatedSockets[userId];

			if (socketId) {
				console.log(`Sending message to ${userId}:`, message);

				this._send(socketId, message);
			} else {
				console.log(`Can’t send message to offline or non-existant user ${userId}.`);
			}
		}
	}
}
