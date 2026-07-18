import { HANABI_MIN_PLAYERS } from '@hanabi/shared';
import express from 'express';
import path from 'node:path';
import * as url from 'node:url';
import { Server as HTTPServer } from 'node:http';
import { createApp } from './app.js';
import HanabiGameFactory from './games/hanabi/HanabiGameFactory.js';
import GameManager from './games/server/GameManager.js';
import { GameStore } from './games/server/GameStore.js';

const PRUNE_INTERVAL_MS = 60_000;

export interface HanabiRuntimeOptions {
	nodeEnv: string;
	sessionCookieSecret: string;
	gameStore: GameStore;
	webDistPath: string;
	redirectUrlProtocolAndSubdomain?: string;
	domainBase?: string;
	minimumPlayers?: number;
}

export interface HanabiRuntime {
	readonly app: express.Express;
	readonly httpServer: HTTPServer;
	readonly ready: boolean;
	start(port: number, hostname?: string): Promise<void>;
	close(): Promise<void>;
}

export function createHanabiRuntime(options: HanabiRuntimeOptions): HanabiRuntime {
	const appRuntime = createApp({
		nodeEnv: options.nodeEnv,
		sessionCookieSecret: options.sessionCookieSecret,
	});
	const { app, socketManager } = appRuntime;
	const gameManager = new GameManager(socketManager, options.gameStore);
	gameManager.addGameFactory(new HanabiGameFactory(options.minimumPlayers ?? HANABI_MIN_PLAYERS));

	let ready = false;
	let started = false;
	let closed = false;
	let socketPruneInterval: ReturnType<typeof setInterval> | null = null;
	let gamePruneInterval: ReturnType<typeof setInterval> | null = null;

	if (options.redirectUrlProtocolAndSubdomain) {
		app.use((req, res, next) => {
			if (req.headers.host?.match(/^www\..*/i)) {
				res.redirect(301, url.parse(`${options.domainBase || ''}${req.url}`).href);
				return;
			}
			if (req.url.endsWith('/') && req.url.length > 1) {
				res.redirect(301, url.parse(`${options.domainBase || ''}${req.url.slice(0, -1)}`).href);
				return;
			}
			next();
		});
	}

	app.get('/api/readyz', (_req, res) => {
		res.status(ready ? 200 : 503).json({ ready });
	});

	if (options.nodeEnv === 'production') {
		app.use(
			'/assets',
			express.static(path.join(options.webDistPath, 'assets'), {
				immutable: true,
				maxAge: '1y',
			}),
		);
		app.use(
			express.static(options.webDistPath, {
				index: false,
				setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache'),
			}),
		);
		app.get('*', (_req, res) => {
			res.set('Cache-Control', 'no-cache');
			res.sendFile(path.join(options.webDistPath, 'index.html'));
		});
	} else {
		app.get('*', (_req, res) => {
			res.json({ message: 'Hanabi API Server - Use Vite dev server for client' });
		});
	}

	const close = async (): Promise<void> => {
		if (closed) return;
		closed = true;
		ready = false;
		if (socketPruneInterval) clearInterval(socketPruneInterval);
		if (gamePruneInterval) clearInterval(gamePruneInterval);
		const results = await Promise.allSettled([appRuntime.close(), gameManager.close()]);
		const errors: unknown[] = [];
		for (const result of results) {
			if (result.status === 'rejected') errors.push(result.reason as unknown);
		}
		if (errors.length > 0) throw new AggregateError(errors, 'Failed to close the server runtime.');
	};

	return {
		app,
		httpServer: appRuntime.httpServer,
		get ready() {
			return ready;
		},
		async start(port, hostname) {
			if (started) throw new Error('Hanabi runtime has already been started.');
			if (closed) throw new Error('Hanabi runtime has already been closed.');
			started = true;
			try {
				await gameManager.restoreGames();
				gameManager.prune();
				socketManager.prune();
				await appRuntime.listen(port, hostname);
				socketPruneInterval = setInterval(() => socketManager.prune(), PRUNE_INTERVAL_MS);
				gamePruneInterval = setInterval(() => gameManager.prune(), PRUNE_INTERVAL_MS);
				socketPruneInterval.unref();
				gamePruneInterval.unref();
				ready = true;
			} catch (error) {
				await close().catch(() => undefined);
				throw error;
			}
		},
		close,
	};
}
