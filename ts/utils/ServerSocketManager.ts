import { Server } from 'http';
import * as socket from 'socket.io';
import * as uuid from 'uuid';
import { invert } from 'lodash';

import Logger from '../utils/Logger';
import { SocketMessage, AuthenticateSocketMessage, AuthenticateResponseSocketMessage } from '../models/SocketMessage';
import PubSub from './PubSub';

interface AuthToken {
	created: Date;
	userId: string;
	token: string;
}

const TOKEN_EXPIRATION_MINUTES = 5;

class ServerSocketManager {
	private _server?: SocketIO.Server;
	
	private _authenticatedUsers: { [socketId: string]: string } = {};
	private _tokens: { [token: string]: AuthToken } = {};
	
	public _onConnect = new PubSub<{ userId: string }>();
	public _onDisconnect = new PubSub<{ userId: string }>();
	public _onMessage = new PubSub<{ userId: string, message: SocketMessage }>();
	
	public get onConnect() { return this._onConnect; }
	public get onDisconnect() { return this._onDisconnect; }
	public get onMessage() { return this._onMessage; }
	
	constructor() {
		setInterval(this._purgeTokens, TOKEN_EXPIRATION_MINUTES * 60 * 1000);
	}
	
	public connect(server: Server) {
		this._server = socket(server);
		
		this._server.on('connection', (socket) => {
			this._handleConnect(socket.id);
			
			socket.on('message', (data: SocketMessage) => {
				this._handleMessage(socket.id, data);
			});

			socket.on('disconnect', () => {
				this._handleDisconnect(socket.id);
			});
		});
	}
	
	public addTokenForUser(userId: string) {
		const token = uuid().substr(0, 6);
		this._tokens[token] = { token, userId, created: new Date() };
		return token;
	}
	
	private _purgeTokens = () => {
		const oldestTime = new Date((new Date()).getTime() - TOKEN_EXPIRATION_MINUTES * 60 * 1000);
		
		for (const token of Object.keys(this._tokens)) {
			if (this._tokens[token].created < oldestTime) {
				delete this._tokens[token];
				Logger.debug(`Purged token "${ token }" from ServerSocketManager.`);
			}
		}
	}
	
	private _handleConnect = (socketId: string) => {
		Logger.debug(`socket.io connected: ${ socketId }`);
	}
	
	private _handleDisconnect = (socketId: string) =>  {
		Logger.debug(`socket.io disconnected: ${ socketId }`);
		
		// Remove the user from our authenticated list.
		const userId = this._authenticatedUsers[socketId];
		delete this._authenticatedUsers[socketId];
		
		this._onDisconnect.emit({ userId });
	}
	
	private _handleMessage = (socketId: string, message: SocketMessage) =>  {
		Logger.debug('socket.io data recieved:', message);
		
		if (message.type === 'AuthenticateSocketMessage') {
			this._handleAuthenticateMessage(socketId, message);
		} else {
			if (this._authenticatedUsers[socketId]) {
				this._onMessage.emit({ userId: this._authenticatedUsers[socketId], message });
			}
		}
	}
	
	private _handleAuthenticateMessage(socketId: string, message: AuthenticateSocketMessage) {
		const token = message.data;
		
		if (this._tokens[token]) {
			const userId = this._tokens[token].userId;
			delete this._tokens[token];
			this._authenticatedUsers[socketId] = userId;
			this._onConnect.emit({ userId });
			
			this._send(socketId, {
				type: 'AuthenticateResponseSocketMessage'
			} as AuthenticateResponseSocketMessage);
		} else {
			this._send(socketId, {
				type: 'AuthenticateResponseSocketMessage',
				data: {
					error: 'Invalid auth token'
				}
			} as AuthenticateResponseSocketMessage);
		}
	}
	
	private _send(socketId: string, message: Partial<SocketMessage>) {
		const blankMessage = { type: '', data: {} };
		this._server!.to(socketId).emit('message', { ...blankMessage, ...message });
	}
	
	public send(userId: string, message: SocketMessage) {
		const authenticatedSockets = invert(this._authenticatedUsers) as { [userId: string]: string };
		const socketId = authenticatedSockets[userId];
		
		if (!socketId) {
			throw new Error('Invalid userid.');
		}
		
		console.log(`sending message to ${ userId }:`, message);
		
		this._send(socketId, message);
	}
}

const instance = new ServerSocketManager();
export default instance;
