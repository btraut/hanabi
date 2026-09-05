import {
	GAME_MANAGER_SCOPE,
	HANABI_GAME_TITLE,
	HanabiStage,
	SOCKET_MANAGER_SCOPE,
	getScope,
	type AuthenticateSocketResponseMessage,
	type GameManagerMessage,
	type HanabiGameData,
	type HanabiMessage,
	type SocketMessageBase,
} from '@hanabi/shared';
import { mkdtemp, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { io, type Socket } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import LocalFileGameStore from './games/server/LocalFileGameStore.js';
import { createHanabiRuntime, type HanabiRuntime } from './runtime.js';

type Message = GameManagerMessage | HanabiMessage | AuthenticateSocketResponseMessage;
type MessageData = { [M in Message as M['type']]: M['data'] };
type Session = { socket: Socket; cookie: string; userId: string };
const runtimes: HanabiRuntime[] = [];
const sockets: Socket[] = [];
const directories: string[] = [];

async function startRuntime(directory: string) {
	const runtime = createHanabiRuntime({
		nodeEnv: 'development',
		sessionCookieSecret: 'restart-test-secret-at-least-32-characters',
		gameStore: new LocalFileGameStore(directory),
		webDistPath: directory,
	});
	runtimes.push(runtime);
	await runtime.start(0, '127.0.0.1');
	const { port } = runtime.httpServer.address() as AddressInfo;
	return { runtime, url: `http://127.0.0.1:${port}` };
}

function request<T extends Message['type']>(
	socket: Socket,
	message: SocketMessageBase & { data: unknown },
	responseType: T,
): Promise<MessageData[T]> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			socket.off('message', receive);
			reject(new Error(`Timed out waiting for ${responseType}.`));
		}, 3_000);
		const receive = (response: Message) => {
			if (response.scope !== message.scope || response.type !== responseType) return;
			clearTimeout(timer);
			socket.off('message', receive);
			resolve(response.data as MessageData[T]);
		};
		socket.on('message', receive);
		socket.emit('message', message);
	});
}

async function connectSession(url: string, cookie?: string): Promise<Session> {
	const response = await fetch(`${url}/api/auth-socket`, {
		headers: cookie ? { cookie } : {},
	});
	expect(response.status).toBe(200);
	const { token } = (await response.json()) as { token: string };
	const sessionCookie = response.headers.get('set-cookie')?.split(';', 1)[0] ?? cookie;
	expect(sessionCookie).toBeTruthy();
	const socket = io(url, { forceNew: true, reconnection: false, transports: ['websocket'] });
	sockets.push(socket);
	await new Promise<void>((resolve, reject) => {
		socket.once('connect', resolve);
		socket.once('connect_error', reject);
	});
	const auth = await request(
		socket,
		{ scope: SOCKET_MANAGER_SCOPE, type: 'AuthenticateSocketMessage', data: token },
		'AuthenticateSocketResponseMessage',
	);
	expect(auth.error).toBeUndefined();
	expect(auth.userId).toBeTruthy();
	return { socket, cookie: sessionCookie!, userId: auth.userId! };
}

async function watch(session: Session, code: string) {
	const response = await request(
		session.socket,
		{ scope: GAME_MANAGER_SCOPE, type: 'WatchGameMessage', data: { code } },
		'WatchGameResponseMessage',
	);
	expect(response.error).toBeUndefined();
	expect(response.game).toBeDefined();
	return response.game!;
}

function read(session: Session, scope: string) {
	return request(
		session.socket,
		{ scope, type: 'GetGameDataMessage', data: undefined },
		'RefreshGameDataMessage',
	);
}

async function createPlayingRoom() {
	const directory = await mkdtemp(path.join(tmpdir(), 'hanabi-restart-test-'));
	directories.push(directory);
	const { runtime, url } = await startRuntime(directory);
	const host = await connectSession(url);
	const guest = await connectSession(url);
	const created = await request(
		host.socket,
		{
			scope: GAME_MANAGER_SCOPE,
			type: 'CreateGameMessage',
			data: { title: HANABI_GAME_TITLE, watch: true },
		},
		'CreateGameResponseMessage',
	);
	expect(created.error).toBeUndefined();
	const game = created.game!;
	const scope = getScope(HANABI_GAME_TITLE, game.id);
	await watch(guest, game.code);
	for (const [session, name] of [
		[host, 'Host'],
		[guest, 'Guest'],
	] as const) {
		expect(
			await request(
				session.socket,
				{ scope, type: 'AddPlayerMessage', data: { name } },
				'AddPlayerResponseMessage',
			),
		).toEqual({});
	}
	expect(
		await request(
			host.socket,
			{ scope, type: 'ChangeGameSettingsMessage', data: { criticalGameOver: false } },
			'ChangeGameSettingsResponseMessage',
		),
	).toEqual({});
	expect(
		await request(
			host.socket,
			{ scope, type: 'StartGameMessage', data: undefined },
			'StartGameResponseMessage',
		),
	).toEqual({});
	const started = await read(host, scope);
	expect(started.stage).toBe(HanabiStage.Playing);
	const current = started.currentPlayerId === host.userId ? host : guest;
	const recipient = current === host ? guest : host;
	const currentView = current === host ? started : await read(current, scope);
	const tile = currentView.tiles[currentView.playerTiles[recipient.userId][0]];
	expect(
		await request(
			current.socket,
			{
				scope,
				type: 'GiveClueMessage',
				data: { to: recipient.userId, number: tile.number },
			},
			'GiveClueResponseMessage',
		),
	).toEqual({});
	const before = await read(guest, scope);
	await runtime.close();
	const restarted = await startRuntime(directory);
	return { ...restarted, host, guest, game, scope, before };
}

function withoutPresence(data: HanabiGameData): HanabiGameData {
	return {
		...data,
		players: Object.fromEntries(
			Object.entries(data.players).map(([id, player]) => [id, { ...player, connected: false }]),
		),
	};
}

afterEach(async () => {
	for (const socket of sockets.splice(0)) socket.disconnect();
	for (const runtime of runtimes.splice(0)) await runtime.close();
	for (const directory of directories.splice(0))
		await rm(directory, { recursive: true, force: true });
});

describe('game reconnection after a server restart', () => {
	it('restores the original game code, board, owner, and player seats and accepts the next turn', async () => {
		const { url, host, guest, game, scope, before } = await createPlayingRoom();
		const returningHost = await connectSession(url, host.cookie);
		const returningGuest = await connectSession(url, guest.cookie);
		expect(returningHost.userId).toBe(host.userId);
		expect(returningGuest.userId).toBe(guest.userId);
		expect(returningHost.cookie).toBe(host.cookie);
		expect(await watch(returningHost, game.code)).toEqual(game);
		expect(await watch(returningGuest, game.code)).toEqual(game);
		const restored = await read(returningGuest, scope);
		expect(withoutPresence(restored)).toEqual(withoutPresence(before));
		expect(restored.creatorId).toBe(host.userId);
		expect(restored.players[host.userId]).toMatchObject({ name: 'Host', connected: true });
		expect(restored.players[guest.userId]).toMatchObject({ name: 'Guest', connected: true });
		const current = restored.currentPlayerId === host.userId ? returningHost : returningGuest;
		const tileId = restored.playerTiles[current.userId][0];
		expect(
			await request(
				current.socket,
				{ scope, type: 'DiscardTileMessage', data: { id: tileId } },
				'DiscardTileResponseMessage',
			),
		).toEqual({});
		const continued = await read(returningHost, scope);
		expect(continued.discardedTiles).toContain(tileId);
		expect(continued.currentPlayerId).not.toBe(restored.currentPlayerId);
		expect(continued.clues).toBe(restored.clues + 1);
	});

	it.each(['missing', 'tampered'] as const)(
		'does not grant a saved player seat to a %s session cookie',
		async (cookieKind) => {
			const { url, host, game, scope, before } = await createPlayingRoom();
			const tamperedCookie = `${host.cookie.slice(0, -1)}${host.cookie.at(-1) === 'a' ? 'b' : 'a'}`;
			const visitor = await connectSession(
				url,
				cookieKind === 'tampered' ? tamperedCookie : undefined,
			);
			expect(visitor.userId).not.toBe(host.userId);
			expect(await watch(visitor, game.code)).toEqual(game);
			const restored = await read(visitor, scope);
			expect(restored.creatorId).toBe(host.userId);
			expect(restored.players[visitor.userId]).toBeUndefined();
			for (const [type, data, responseType] of [
				['AddPlayerMessage', { name: 'Host' }, 'AddPlayerResponseMessage'],
				['ResetGameMessage', undefined, 'ResetGameResponseMessage'],
				[
					'DiscardTileMessage',
					{ id: before.playerTiles[host.userId][0] },
					'DiscardTileResponseMessage',
				],
			] as const) {
				const response = await request(visitor.socket, { scope, type, data }, responseType);
				expect(response.error).toBeTruthy();
			}
			expect(await read(visitor, scope)).toEqual(restored);
		},
	);
});
