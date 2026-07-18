import compress from 'compression';
import cookieParser from 'cookie-parser';
import express from 'express';
import morgan from 'morgan';
import { randomUUID } from 'node:crypto';
import { createServer, Server as HTTPServer } from 'node:http';
import SocketManager from './utils/SocketManager.js';
import {
	assertValidProductionSessionSecret,
	DEVELOPMENT_SESSION_COOKIE_SECRET,
} from './sessionSecret.js';

export const SESSION_COOKIE_NAME = 'SESSION';
export { DEVELOPMENT_SESSION_COOKIE_SECRET };
const AUTH_TOKEN_RATE_LIMIT = 60;
const AUTH_TOKEN_RATE_WINDOW_MS = 60_000;
const MAX_RATE_LIMIT_KEYS = 10_000;

interface RateLimitEntry {
	count: number;
	windowStartedAt: number;
}

export interface CreateAppOptions {
	nodeEnv: string;
	sessionCookieSecret: string;
}

export interface ServerRuntime {
	app: express.Express;
	httpServer: HTTPServer;
	socketManager: SocketManager;
	listen(port: number, hostname?: string): Promise<void>;
	close(): Promise<void>;
}

export function createApp(options: CreateAppOptions): ServerRuntime {
	assertValidProductionSessionSecret(options.nodeEnv, options.sessionCookieSecret);

	const app = express();
	app.enable('strict routing');
	app.set('trust proxy', 1);
	app.use(compress());
	app.use(morgan('dev'));
	app.use(express.json());
	app.use(express.urlencoded({ extended: true }));
	app.use(cookieParser(options.sessionCookieSecret));

	const httpServer = createServer(app);
	const socketManager = new SocketManager(httpServer);
	socketManager.start();
	const authTokenRateLimits = new Map<string, RateLimitEntry>();

	app.get('/api/auth-socket', (req, res) => {
		res.set('Cache-Control', 'no-store');
		const now = Date.now();
		const rateLimitKey = req.ip || req.socket.remoteAddress || 'unknown';
		let rateLimit = authTokenRateLimits.get(rateLimitKey);
		if (!rateLimit || now - rateLimit.windowStartedAt >= AUTH_TOKEN_RATE_WINDOW_MS) {
			rateLimit = { count: 0, windowStartedAt: now };
			authTokenRateLimits.set(rateLimitKey, rateLimit);
		}
		rateLimit.count += 1;
		if (rateLimit.count > AUTH_TOKEN_RATE_LIMIT) {
			res.set('Retry-After', String(Math.ceil(AUTH_TOKEN_RATE_WINDOW_MS / 1000)));
			res.status(429).json({ error: 'Too many authentication attempts.' });
			return;
		}
		if (authTokenRateLimits.size > MAX_RATE_LIMIT_KEYS) {
			for (const [key, entry] of authTokenRateLimits) {
				if (now - entry.windowStartedAt >= AUTH_TOKEN_RATE_WINDOW_MS) {
					authTokenRateLimits.delete(key);
				}
			}
			while (authTokenRateLimits.size > MAX_RATE_LIMIT_KEYS) {
				const oldestKey = authTokenRateLimits.keys().next().value;
				if (typeof oldestKey !== 'string') break;
				authTokenRateLimits.delete(oldestKey);
			}
		}

		const signedCookies: unknown = req.signedCookies;
		const sessionCookie =
			typeof signedCookies === 'object' && signedCookies !== null
				? (signedCookies as Record<string, unknown>)[SESSION_COOKIE_NAME]
				: undefined;
		let userId = typeof sessionCookie === 'string' ? sessionCookie : undefined;
		if (!userId) {
			userId = randomUUID();
			res.cookie(SESSION_COOKIE_NAME, userId, {
				httpOnly: true,
				maxAge: 365 * 24 * 60 * 60 * 1000,
				sameSite: 'lax',
				secure: options.nodeEnv === 'production',
				signed: true,
			});
		}

		res.json({ token: socketManager.addTokenForUser(userId, rateLimitKey) });
	});

	return {
		app,
		httpServer,
		socketManager,
		listen: (port, hostname) =>
			new Promise((resolve, reject) => {
				const handleError = (error: Error) => reject(error);
				httpServer.once('error', handleError);
				httpServer.listen(port, hostname, () => {
					httpServer.off('error', handleError);
					resolve();
				});
			}),
		close: () => socketManager.close(),
	};
}
