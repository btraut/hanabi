import {
	AuthenticateSocketMessage,
	AuthenticateSocketResponseMessage,
	SOCKET_MANAGER_MESSAGE_SCOPE,
} from 'app/src/utils/SocketManagerMessages';
import { Server as HTTPServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { v1 as uuidv1 } from 'uuid';

import { SocketMessageBase } from '../../models/SocketMessage';
import PubSub from '../PubSub';
import Logger from './Logger';

interface AuthToken {
	created: Date;
	userId: string;
	token: string;
}

export default class ServerSocketManager {
	private _server: SocketServer;

	private _authenticatedUsers: { [socketId: string]: string } = {};

	public _onConnect = new PubSub<{ userId: string }>();
	public _onDisconnect = new PubSub<{ userId: string }>();
	public _onMessage = new PubSub<{ userId: string; message: SocketMessageBase }>();

	private _tokens: { [token: string]: AuthToken } = {};

	public get onConnect(): PubSub<{ userId: string }> {
		return this._onConnect;
	}
	public get onDisconnect(): PubSub<{ userId: string }> {
		return this._onDisconnect;
	}
	public get onMessage(): PubSub<{ userId: string | undefined; message: SocketMessageBase }> {
		return this._onMessage;
	}

	constructor(httpServer: HTTPServer) {
		this._server = new SocketServer(httpServer);
	}

	public addTokenForUser(userId: string): string {
		const token = uuidv1().substr(0, 6);
		this._tokens[token] = { token, userId, created: new Date() };
		return token;
	}

	public start(): void {
		this._server.on('connection', (connection) => {
			this._handleConnect(connection.id);

			connection.on('disconnect', () => {
				this._handleDisconnect(connection.id);
			});

			connection.on('message', (data: SocketMessageBase) => {
				this._handleMessage(connection.id, data);
			});
		});
	}

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

	private _handleMessage = (socketId: string, message: SocketMessageBase) => {
		Logger.debug('socket.io data recieved:', message);

		if (message.type === 'AuthenticateSocketMessage') {
			this._handleAuthenticateMessage(socketId, message as AuthenticateSocketMessage);
		} else {
			if (this._authenticatedUsers[socketId]) {
				this._onMessage.emit({ userId: this._authenticatedUsers[socketId], message });
			}
		}
	};

	private _send(socketId: string, message: Partial<SocketMessageBase>) {
		const blankMessage = { type: '', data: {} };
		this._server!.to(socketId).emit('message', { ...blankMessage, ...message });
	}

	public send(userIdOrIds: string | readonly string[], message: SocketMessageBase): void {
		const userIds = typeof userIdOrIds === 'string' ? [userIdOrIds] : userIdOrIds;

		const authenticatedSockets = Object.keys(this._authenticatedUsers).reduce<{
			[userId: string]: string[];
		}>((sockets, socketId) => {
			const userId = this._authenticatedUsers[socketId];
			if (!sockets[userId]) {
				sockets[userId] = [];
			}
			sockets[userId].push(socketId);
			return sockets;
		}, {});

		for (const userId of userIds) {
			const socketIds = authenticatedSockets[userId];

			if (socketIds) {
				console.log(`Sending message(s) to ${userId}:`, message);

				for (const socketId of socketIds) {
					this._send(socketId, message);
				}
			} else {
				console.log(`Can’t send message to offline or non-existant user ${userId}.`);
			}
		}
	}

	public addScopedMessageHandler<MessageType extends SocketMessageBase>(
		handler: (data: { userId: string; message: MessageType }) => void,
		scope: string,
	): void {
		this.onMessage.subscribe((d) => {
			if (d.message.scope !== scope) {
				return;
			}

			// At this point, we presume that the scope check has limited the
			// message type to only those used in this handler. It's possible
			// that this is not true, but in practice, we should always limit a
			// specific scope to its associated types.
			handler(d as any);
		});
	}

	private _handleAuthenticateMessage(socketId: string, message: AuthenticateSocketMessage) {
		const token = message.data;

		if (this._tokens[token]) {
			const userId = this._tokens[token].userId;
			delete this._tokens[token];
			this._authenticatedUsers[socketId] = userId;

			// Only when a user is authenticated do we truly consider it a
			// connection. Until then, we don't know how to associate a socketId
			// with a userId.
			this._onConnect.emit({ userId });

			const authenticateResponseSocketMessage: AuthenticateSocketResponseMessage = {
				scope: SOCKET_MANAGER_MESSAGE_SCOPE,
				type: 'AuthenticateSocketResponseMessage',
				data: {},
			};
			this._send(socketId, authenticateResponseSocketMessage);
		} else {
			const authenticateResponseSocketMessage: AuthenticateSocketResponseMessage = {
				scope: SOCKET_MANAGER_MESSAGE_SCOPE,
				type: 'AuthenticateSocketResponseMessage',
				data: {
					error: 'Invalid auth token',
				},
			};
			this._send(socketId, authenticateResponseSocketMessage);
		}
	}

	public prune(olderThan = 5 * 60 * 1000): void {
		const oldestTime = new Date(new Date().getTime() - olderThan);

		for (const token of Object.keys(this._tokens)) {
			if (this._tokens[token].created < oldestTime) {
				delete this._tokens[token];
				Logger.debug(`Purged token "${token}" from ServerSocketManager.`);
			}
		}
	}
}
