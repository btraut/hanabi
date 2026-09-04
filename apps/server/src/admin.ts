import express from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { GameTranscriptSummaryReader } from './games/hanabi/PostgresGameTranscriptSummaryReader.js';
import Logger from './utils/Logger.js';

export const ADMIN_SESSION_COOKIE_NAME = 'HANABI_ADMIN';
const ADMIN_SESSION_COOKIE_VALUE = 'authorized';

export interface AdminRouterOptions {
	nodeEnv: string;
	password: string;
	transcriptSummaryReader?: GameTranscriptSummaryReader;
}

function secretsMatch(candidate: string, expected: string): boolean {
	const candidateDigest = createHash('sha256').update(candidate).digest();
	const expectedDigest = createHash('sha256').update(expected).digest();
	return timingSafeEqual(candidateDigest, expectedDigest);
}

function hasAdminSession(signedCookies: unknown): boolean {
	if (typeof signedCookies !== 'object' || signedCookies === null) return false;
	return (
		(signedCookies as Record<string, unknown>)[ADMIN_SESSION_COOKIE_NAME] ===
		ADMIN_SESSION_COOKIE_VALUE
	);
}

function parsePage(value: unknown): number | null {
	if (value === undefined) return 1;
	if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
	const page = Number(value);
	return Number.isSafeInteger(page) && page >= 1 ? page : null;
}

export function createAdminRouter(options: AdminRouterOptions): express.Router {
	const router = express.Router();
	const secure = options.nodeEnv === 'production';
	const cookieOptions = {
		httpOnly: true,
		path: '/api/admin',
		sameSite: 'strict' as const,
		secure,
	};

	router.use((_req, res, next) => {
		res.set('Cache-Control', 'no-store');
		res.set('X-Robots-Tag', 'noindex, nofollow');
		next();
	});

	router.post('/session', (req, res) => {
		const password =
			typeof req.body === 'object' && req.body !== null
				? (req.body as Record<string, unknown>).password
				: undefined;
		if (typeof password !== 'string' || !secretsMatch(password, options.password)) {
			res.status(401).json({ error: 'Invalid password.' });
			return;
		}

		res.cookie(ADMIN_SESSION_COOKIE_NAME, ADMIN_SESSION_COOKIE_VALUE, {
			...cookieOptions,
			signed: true,
		});
		res.status(204).end();
	});

	router.delete('/session', (_req, res) => {
		res.clearCookie(ADMIN_SESSION_COOKIE_NAME, cookieOptions);
		res.status(204).end();
	});

	router.get('/transcripts', (req, res) => {
		if (!hasAdminSession(req.signedCookies)) {
			res.status(401).json({ error: 'Authentication required.' });
			return;
		}

		const page = parsePage(req.query.page);
		if (page === null) {
			res.status(400).json({ error: 'Page must be a positive integer.' });
			return;
		}
		if (!options.transcriptSummaryReader) {
			res.status(503).json({ error: 'Round history is unavailable.' });
			return;
		}

		void options.transcriptSummaryReader
			.list(page)
			.then((result) => res.json(result))
			.catch((error: unknown) => {
				const errorName = error instanceof Error ? error.name : 'UnknownError';
				Logger.error(`Failed to load admin round history (${errorName}).`);
				res.status(503).json({ error: 'Round history is unavailable.' });
			});
	});

	return router;
}
