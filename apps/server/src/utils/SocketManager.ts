import {
	SocketMessageBase,
	AuthenticateSocketMessage,
	SOCKET_MANAGER_SCOPE,
	GAME_MANAGER_SCOPE,
	PubSub,
} from '@hanabi/shared';
import Logger from './Logger.js';
import { randomBytes } from 'node:crypto';
import { Server as HTTPServer } from 'http';
import { Server as SocketServer } from 'socket.io';

const AUTH_TOKEN_BYTES = 32;
const AUTH_TOKEN_TTL_MS = 5 * 60 * 1000;
const MAX_OUTSTANDING_TOKENS_PER_USER = 5;
const MAX_OUTSTANDING_TOKENS = 10_000;
const MAX_FAILED_AUTH_ATTEMPTS_PER_SOCKET = 5;
const MAX_SOCKET_MESSAGE_BYTES = 64 * 1024;
const MESSAGE_BUDGET_CAPACITY = 120;
const MESSAGE_BUDGET_REFILL_PER_SECOND = 30;
const FULL_STATE_MESSAGE_COST = 30;
const MESSAGE_BUDGET_RETENTION_MS = 60_000;
const RATE_LIMIT_WARNING_INTERVAL_MS = 10_000;
const LOGGED_MESSAGE_TYPES = new Set([
	'AuthenticateSocketMessage',
	'AuthenticateSocketResponseMessage',
	'GetGameDataMessage',
	'RefreshGameDataMessage',
	...[
		'CreateGame',
		'WatchGame',
		'AddPlayer',
		'RemovePlayer',
		'AddBot',
		'RetryBotTurn',
		'CreateDebugPlayer',
		'DebugPlayerAction',
		'ChangeGameSettings',
		'SendChat',
		'StartGame',
		'ResetGame',
		'PlayTile',
		'DiscardTile',
		'GiveClue',
		'MoveTiles',
	].flatMap((name) => [`${name}Message`, `${name}ResponseMessage`]),
]);

function messageLogFields(message: unknown): { type: string; scope: string } {
	const envelope =
		typeof message === 'object' && message !== null ? (message as Record<string, unknown>) : {};
	const type =
		typeof envelope.type === 'string' && LOGGED_MESSAGE_TYPES.has(envelope.type)
			? envelope.type
			: 'unknown';
	const scope =
		typeof envelope.scope === 'string' &&
		(envelope.scope === SOCKET_MANAGER_SCOPE ||
			envelope.scope === GAME_MANAGER_SCOPE ||
			/^game\.hanabi\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
				envelope.scope,
			))
			? envelope.scope
			: 'unknown';
	return { type, scope };
}

function handlerErrorLogFields(error: unknown): { errorKind: string; sourceFrames: string[] } {
	if (!(error instanceof Error)) return { errorKind: 'NonError', sourceFrames: [] };
	const errorKinds = [
		TypeError,
		RangeError,
		ReferenceError,
		SyntaxError,
		URIError,
		EvalError,
		AggregateError,
	];
	const errorKind = errorKinds.find((kind) => error instanceof kind)?.name ?? 'Error';
	// Strip the full header, including multiline messages, before selecting source locations.
	const header = error.message ? `${error.name}: ${error.message}` : error.name;
	const frames = error.stack?.startsWith(header)
		? error.stack.slice(header.length).split('\n')
		: [];
	const sourceFrames = frames
		.flatMap((frame) => {
			const location = /^\s+at (?:.* \()?((?:file:\/\/\/|\/)[^()\s?#]+):(\d+):(\d+)\)?$/.exec(
				frame,
			);
			const source = location?.[1].match(
				/(?:^|\/)((?:apps\/server|packages\/shared|dist\/apps\/server)\/[^()\s?#]+\.(?:[cm]?[jt]s|tsx|jsx))$/,
			)?.[1];
			return location && source ? [`${source}:${location[2]}:${location[3]}`] : [];
		})
		.slice(0, 10);
	return { errorKind, sourceFrames };
}

interface AuthToken {
	abuseKey: string;
	created: Date;
	userId: string;
	token: string;
}

interface MessageBudget {
	tokens: number;
	updatedAt: number;
	expiresAt?: number;
	lastWarningAt?: number;
}

export default class ServerSocketManager {
	private _server: SocketServer;

	private _authenticatedUsers: { [socketId: string]: string } = {};
	private _authenticatedSockets: { [userId: string]: string[] } = {};
	private _authenticatedAbuseKeys: { [socketId: string]: string } = {};

	public _onConnect = new PubSub<{ socketId: string }>();
	public _onAuthenticate = new PubSub<{ userId: string }>();
	public _onDisconnect = new PubSub<{ userId: string }>();
	public _onMessage = new PubSub<{
		abuseKey: string;
		socketId: string;
		userId: string | undefined;
		message: SocketMessageBase;
	}>();

	private _tokens = new Map<string, AuthToken>();
	private _tokensByUser = new Map<string, Set<string>>();
	private _failedAuthAttempts = new Map<string, number>();
	private _messageBudgets = new Map<string, MessageBudget>();
	private _lastTokenPruneAt = 0;

	public get onConnect(): PubSub<{ socketId: string }> {
		return this._onConnect;
	}
	public get onAuthenticate(): PubSub<{ userId: string }> {
		return this._onAuthenticate;
	}
	public get onDisconnect(): PubSub<{ userId: string }> {
		return this._onDisconnect;
	}
	public get onMessage(): PubSub<{
		abuseKey: string;
		socketId: string;
		userId: string | undefined;
		message: SocketMessageBase;
	}> {
		return this._onMessage;
	}

	constructor(httpServer: HTTPServer) {
		this._server = new SocketServer(httpServer, {
			maxHttpBufferSize: MAX_SOCKET_MESSAGE_BYTES,
		});
	}

	public addTokenForUser(userId: string, abuseKey = 'unknown'): string {
		if (Date.now() - this._lastTokenPruneAt >= 30_000) {
			this.prune();
		}
		const userTokens = this._tokensByUser.get(userId) ?? new Set<string>();
		while (userTokens.size >= MAX_OUTSTANDING_TOKENS_PER_USER) {
			const oldestToken = userTokens.values().next().value;
			if (typeof oldestToken !== 'string') break;
			this._deleteToken(oldestToken);
		}
		while (this._tokens.size >= MAX_OUTSTANDING_TOKENS) {
			const oldestToken = this._tokens.keys().next().value;
			if (typeof oldestToken !== 'string') break;
			this._deleteToken(oldestToken);
		}

		const token = randomBytes(AUTH_TOKEN_BYTES).toString('base64url');
		this._tokens.set(token, { token, userId, abuseKey, created: new Date() });
		userTokens.add(token);
		this._tokensByUser.set(userId, userTokens);
		return token;
	}

	public close(): Promise<void> {
		return this._server.close();
	}

	public start(): void {
		this._server.on('connection', (connection) => {
			this._handleConnect(connection.id, connection.conn.transport.name);

			connection.on('disconnect', (reason) => {
				this._handleDisconnect(connection.id, reason);
			});

			connection.on('message', (data: SocketMessageBase) => {
				this._handleMessage(connection.id, data);
			});
		});
	}

	private _handleConnect = (socketId: string, transport: string) => {
		Logger.event('socket.connected', { socketId, transport });

		this._onConnect.emit({ socketId });
	};

	private _handleDisconnect = (socketId: string, reason: string) => {
		const userId = this._authenticatedUsers[socketId];
		this._failedAuthAttempts.delete(socketId);
		this._removeSocketAuthentication(socketId);
		const remainingSocketCount = userId ? (this._authenticatedSockets[userId]?.length ?? 0) : 0;
		Logger.event('socket.disconnected', {
			socketId,
			userId,
			reason,
			remainingSocketCount,
			playerOffline: !!userId && remainingSocketCount === 0,
		});
	};

	private _removeSocketAuthentication(socketId: string): void {
		const userId = this._authenticatedUsers[socketId];
		if (!userId) {
			return;
		}

		delete this._authenticatedUsers[socketId];
		delete this._authenticatedAbuseKeys[socketId];

		// Remove the socket from the user's list.
		const remainingSocketIds = (this._authenticatedSockets[userId] || []).filter(
			(id) => id !== socketId,
		);
		if (remainingSocketIds.length > 0) {
			this._authenticatedSockets[userId] = remainingSocketIds;
			return;
		}

		delete this._authenticatedSockets[userId];
		const budget = this._messageBudgets.get(userId);
		if (budget) budget.expiresAt = Date.now() + MESSAGE_BUDGET_RETENTION_MS;
		this._onDisconnect.emit({ userId });
	}

	private _handleMessage = (socketId: string, message: SocketMessageBase) => {
		const fields = {
			socketId,
			userId: this._authenticatedUsers[socketId],
			...messageLogFields(message),
		};
		if (
			typeof message !== 'object' ||
			message === null ||
			typeof message.scope !== 'string' ||
			message.scope.length > 200 ||
			typeof message.type !== 'string' ||
			message.type.length > 100
		) {
			Logger.event('socket.message_rejected', { ...fields, reason: 'malformed' }, 'warn');
			return;
		}
		Logger.event('socket.message_received', fields, 'debug');

		try {
			// Capture all SocketManager messages. Emit the rest.
			if (message.scope === SOCKET_MANAGER_SCOPE) {
				this._handleSocketManagerMessage(socketId, message);
			} else if (
				this._authenticatedUsers[socketId] &&
				this._consumeMessageBudget(this._authenticatedUsers[socketId], socketId, message)
			) {
				this._onMessage.emit({
					abuseKey: this._authenticatedAbuseKeys[socketId] ?? 'unknown',
					socketId,
					userId: this._authenticatedUsers[socketId],
					message,
				});
			} else if (!this._authenticatedUsers[socketId]) {
				Logger.event('socket.message_rejected', { ...fields, reason: 'unauthenticated' }, 'warn');
			}
		} catch (error) {
			Logger.event(
				'socket.message_failed',
				{
					...fields,
					reason: 'handler_failed',
					...handlerErrorLogFields(error),
				},
				'error',
			);
		}
	};

	private _consumeMessageBudget(
		userId: string,
		socketId: string,
		message: SocketMessageBase,
	): boolean {
		const now = Date.now();
		const retainedBudget = this._messageBudgets.get(userId);
		const budget: MessageBudget =
			retainedBudget?.expiresAt && retainedBudget.expiresAt <= now
				? { tokens: MESSAGE_BUDGET_CAPACITY, updatedAt: now }
				: (retainedBudget ?? { tokens: MESSAGE_BUDGET_CAPACITY, updatedAt: now });
		budget.expiresAt = undefined;
		budget.tokens = Math.min(
			MESSAGE_BUDGET_CAPACITY,
			budget.tokens + ((now - budget.updatedAt) / 1000) * MESSAGE_BUDGET_REFILL_PER_SECOND,
		);
		budget.updatedAt = now;
		const cost = this._messageCost(message.type);
		if (budget.tokens < cost) {
			this._messageBudgets.set(userId, budget);
			if (!budget.lastWarningAt || now - budget.lastWarningAt >= RATE_LIMIT_WARNING_INTERVAL_MS) {
				budget.lastWarningAt = now;
				Logger.event(
					'socket.message_rejected',
					{
						socketId,
						userId,
						...messageLogFields(message),
						reason: 'rate_limited',
					},
					'warn',
				);
			}
			return false;
		}
		budget.tokens -= cost;
		this._messageBudgets.set(userId, budget);
		return true;
	}

	private _messageCost(type: string): number {
		if (type === 'GetGameDataMessage' || type === 'CreateGameMessage') {
			return FULL_STATE_MESSAGE_COST;
		}
		if (
			[
				'WatchGameMessage',
				'AddPlayerMessage',
				'RemovePlayerMessage',
				'ChangeGameSettingsMessage',
				'SendChatMessage',
				'StartGameMessage',
				'ResetGameMessage',
				'PlayTileMessage',
				'DiscardTileMessage',
				'GiveClueMessage',
				'MoveTilesMessage',
			].includes(type)
		) {
			return 10;
		}
		return 1;
	}

	private _handleSocketManagerMessage(socketId: string, message: SocketMessageBase) {
		switch (message.type) {
			case 'AuthenticateSocketMessage':
				this._handleAuthenticateMessage(socketId, message as AuthenticateSocketMessage);
				break;
		}
	}

	private _send<OutboundMessage extends SocketMessageBase>(
		socketId: string,
		message: OutboundMessage,
	) {
		Logger.event(
			'socket.message_sent',
			{
				socketId,
				userId: this._authenticatedUsers[socketId],
				...messageLogFields(message),
			},
			'debug',
		);
		this._server.to(socketId).emit('message', message);
	}

	public send<OutboundMessage extends SocketMessageBase>(
		userIdOrIds: string | readonly string[],
		message: OutboundMessage,
	): void {
		const userIds = typeof userIdOrIds === 'string' ? [userIdOrIds] : userIdOrIds;

		for (const userId of userIds) {
			const socketIds = this._authenticatedSockets[userId];

			if (socketIds && socketIds.length > 0) {
				for (const socketId of socketIds) {
					this._send(socketId, message);
				}
			}
		}
	}

	public sendToSocket<OutboundMessage extends SocketMessageBase>(
		socketId: string,
		message: OutboundMessage,
	): void {
		if (this._authenticatedUsers[socketId]) {
			this._send(socketId, message);
		}
	}

	public addScopedMessageHandler<ScopedMessage extends SocketMessageBase>(
		handler: (data: {
			abuseKey: string;
			socketId: string;
			userId: string;
			message: ScopedMessage;
		}) => void,
		scope: string,
	): number {
		return this.onMessage.subscribe(
			(d: {
				abuseKey: string;
				socketId: string;
				userId: string | undefined;
				message: SocketMessageBase;
			}) => {
				if (d.message.scope !== scope || !d.userId) {
					return;
				}

				handler({
					abuseKey: d.abuseKey,
					socketId: d.socketId,
					userId: d.userId,
					message: d.message as ScopedMessage,
				});
			},
		);
	}

	private _handleAuthenticateMessage(socketId: string, message: AuthenticateSocketMessage) {
		const token = message.data;
		const authToken = typeof token === 'string' ? this._tokens.get(token) : undefined;
		const tokenIsFresh = authToken && authToken.created.getTime() >= Date.now() - AUTH_TOKEN_TTL_MS;

		if (tokenIsFresh) {
			const userId = authToken.userId;
			const previousUserId = this._authenticatedUsers[socketId];
			this._deleteToken(token);
			this._failedAuthAttempts.delete(socketId);
			if (this._authenticatedUsers[socketId] !== userId) {
				this._removeSocketAuthentication(socketId);
			}
			this._authenticatedUsers[socketId] = userId;
			this._authenticatedAbuseKeys[socketId] = authToken.abuseKey;

			if (!this._authenticatedSockets[userId]) {
				this._authenticatedSockets[userId] = [];
			}

			if (!this._authenticatedSockets[userId].includes(socketId)) {
				this._authenticatedSockets[userId].push(socketId);
			}
			if (previousUserId && previousUserId !== userId) {
				Logger.event('socket.identity_changed', {
					socketId,
					previousUserId,
					userId,
					remainingSocketCount: this._authenticatedSockets[previousUserId]?.length ?? 0,
				});
			}
			Logger.event('socket.authenticated', {
				socketId,
				userId,
				previousUserId,
				activeSocketCount: this._authenticatedSockets[userId].length,
			});

			this._onAuthenticate.emit({ userId });

			this._send(socketId, {
				scope: SOCKET_MANAGER_SCOPE,
				type: 'AuthenticateSocketResponseMessage',
				data: { userId },
			});
		} else {
			const failedAttempts = (this._failedAuthAttempts.get(socketId) ?? 0) + 1;
			this._failedAuthAttempts.set(socketId, failedAttempts);
			Logger.event(
				'socket.auth_rejected',
				{
					socketId,
					userId: this._authenticatedUsers[socketId],
					failedAttempts,
					reason: authToken ? 'expired_token' : 'invalid_token',
					disconnecting: failedAttempts >= MAX_FAILED_AUTH_ATTEMPTS_PER_SOCKET,
				},
				'warn',
			);
			this._send(socketId, {
				scope: SOCKET_MANAGER_SCOPE,
				type: 'AuthenticateSocketResponseMessage',
				data: {
					error: 'Invalid auth token',
				},
			});
			if (failedAttempts >= MAX_FAILED_AUTH_ATTEMPTS_PER_SOCKET) {
				this._server.sockets.sockets.get(socketId)?.disconnect(true);
			}
		}
	}

	private _deleteToken(token: string): void {
		const authToken = this._tokens.get(token);
		if (!authToken) return;
		this._tokens.delete(token);
		const userTokens = this._tokensByUser.get(authToken.userId);
		userTokens?.delete(token);
		if (userTokens?.size === 0) this._tokensByUser.delete(authToken.userId);
	}

	public prune(olderThan = 5 * 60 * 1000): void {
		this._lastTokenPruneAt = Date.now();
		const oldestTime = new Date(new Date().getTime() - olderThan);
		let expiredTokenCount = 0;

		for (const [token, authToken] of this._tokens) {
			if (authToken.created < oldestTime) {
				this._deleteToken(token);
				expiredTokenCount += 1;
			}
		}
		if (expiredTokenCount > 0) Logger.event('socket.tokens_pruned', { expiredTokenCount }, 'debug');
		for (const [userId, budget] of this._messageBudgets) {
			if (budget.expiresAt && budget.expiresAt <= Date.now()) {
				this._messageBudgets.delete(userId);
			}
		}
	}
}
