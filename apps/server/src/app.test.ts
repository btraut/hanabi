import { AuthenticateSocketResponseMessage, SOCKET_MANAGER_SCOPE } from '@hanabi/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { io, Socket } from 'socket.io-client';
import { AddressInfo } from 'node:net';
import { createApp, ServerRuntime } from './app.js';

const runtimes: ServerRuntime[] = [];
const sockets: Socket[] = [];

async function startRuntime(nodeEnv: 'development' | 'production' = 'development') {
	const runtime = createApp({
		nodeEnv,
		sessionCookieSecret: 'integration-test-secret-at-least-32-chars',
	});
	runtimes.push(runtime);

	await runtime.listen(0, '127.0.0.1');
	const address = runtime.httpServer.address() as AddressInfo;
	return { runtime, url: `http://127.0.0.1:${address.port}` };
}

function connect(url: string): Promise<Socket> {
	return new Promise((resolve, reject) => {
		const socket = io(url, {
			forceNew: true,
			reconnection: false,
			transports: ['websocket'],
		});
		sockets.push(socket);
		socket.once('connect', () => resolve(socket));
		socket.once('connect_error', reject);
	});
}

function authenticate(socket: Socket, token: string): Promise<AuthenticateSocketResponseMessage> {
	return new Promise((resolve) => {
		socket.on('message', (message: AuthenticateSocketResponseMessage) => {
			if (message.type === 'AuthenticateSocketResponseMessage') {
				resolve(message);
			}
		});
		socket.emit('message', {
			scope: SOCKET_MANAGER_SCOPE,
			type: 'AuthenticateSocketMessage',
			data: token,
		});
	});
}

afterEach(async () => {
	for (const socket of sockets.splice(0)) {
		socket.disconnect();
	}
	for (const runtime of runtimes.splice(0)) {
		await runtime.close();
	}
});

describe('createApp', () => {
	it('bootstraps one signed session and returns a usable token on the first request', async () => {
		const { url } = await startRuntime();

		const authResponse = await fetch(`${url}/api/auth-socket`);
		const cookie = authResponse.headers.get('set-cookie');
		const { token } = (await authResponse.json()) as { token: string };

		expect(authResponse.status).toBe(200);
		expect(authResponse.headers.get('cache-control')).toBe('no-store');
		expect(cookie).toMatch(/^SESSION=s%3A/);
		expect(cookie).toContain('HttpOnly');
		expect(cookie).toContain('SameSite=Lax');
		expect(cookie).not.toContain('Secure');
		expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

		const firstSocket = await connect(url);
		const firstAuth = await authenticate(firstSocket, token);
		expect(typeof firstAuth.data.userId).toBe('string');
		expect(firstAuth.data.error).toBeUndefined();

		const cookieHeader = cookie!.split(';', 1)[0];
		const nextAuthResponse = await fetch(`${url}/api/auth-socket`, {
			headers: { cookie: cookieHeader },
		});
		const nextAuth = (await nextAuthResponse.json()) as { token: string };
		const secondSocket = await connect(url);
		const secondSocketAuth = await authenticate(secondSocket, nextAuth.token);

		expect(nextAuthResponse.headers.get('set-cookie')).toBeNull();
		expect(secondSocketAuth.data.userId).toBe(firstAuth.data.userId);
	});

	it('replaces tampered session cookies instead of trusting their identity', async () => {
		const { url } = await startRuntime();
		const firstResponse = await fetch(`${url}/api/auth-socket`);
		const firstCookie = firstResponse.headers.get('set-cookie')!.split(';', 1)[0];
		const firstToken = ((await firstResponse.json()) as { token: string }).token;
		const firstSocket = await connect(url);
		const firstAuth = await authenticate(firstSocket, firstToken);

		const lastCharacter = firstCookie.at(-1);
		const tamperedCookie = `${firstCookie.slice(0, -1)}${lastCharacter === 'a' ? 'b' : 'a'}`;
		const tamperedResponse = await fetch(`${url}/api/auth-socket`, {
			headers: { cookie: tamperedCookie },
		});
		const replacementToken = ((await tamperedResponse.json()) as { token: string }).token;
		const replacementSocket = await connect(url);
		const replacementAuth = await authenticate(replacementSocket, replacementToken);

		expect(tamperedResponse.headers.get('set-cookie')).toMatch(/^SESSION=s%3A/);
		expect(replacementAuth.data.userId).not.toBe(firstAuth.data.userId);
	});

	it('marks production session cookies secure and rejects the development secret', async () => {
		const { url } = await startRuntime('production');
		const response = await fetch(`${url}/api/auth-socket`);

		expect(response.headers.get('set-cookie')).toContain('Secure');
		expect(() => createApp({ nodeEnv: 'production', sessionCookieSecret: 'dev-secret' })).toThrow(
			'SESSION_COOKIE_SECRET',
		);
		expect(() =>
			createApp({ nodeEnv: 'production', sessionCookieSecret: 'still-too-short' }),
		).toThrow('at least 32 characters');
		expect(() =>
			createApp({
				nodeEnv: 'production',
				sessionCookieSecret: 'replace-with-at-least-32-random-characters',
			}),
		).toThrow('documented placeholder');
	});

	it('rate limits unauthenticated token issuance', async () => {
		const { url } = await startRuntime();
		for (let attempt = 0; attempt < 60; attempt += 1) {
			expect((await fetch(`${url}/api/auth-socket`)).status).toBe(200);
		}

		const limitedResponse = await fetch(`${url}/api/auth-socket`);
		expect(limitedResponse.status).toBe(429);
		expect(limitedResponse.headers.get('retry-after')).toBe('60');
	});
});
