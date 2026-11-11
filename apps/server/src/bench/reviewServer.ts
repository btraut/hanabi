import { execFile, spawn } from 'node:child_process';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import express from 'express';
import { readReviewSnapshot } from './reviewData.js';
import { errorMessage } from './storage.js';

interface ReviewOptions {
	directory: string;
	port?: number;
	open?: boolean;
	allowMissing?: boolean;
	signal?: AbortSignal;
}

export interface ReviewServer {
	url: string;
	close(): Promise<void>;
	closed: Promise<void>;
}

async function checkDirectory(directory: string, allowMissing = false) {
	try {
		if (!(await stat(directory)).isDirectory())
			throw new Error('Review needs an artifact directory.');
	} catch (error) {
		if (allowMissing && (error as NodeJS.ErrnoException).code === 'ENOENT') return;
		throw error;
	}
}

/** The HTTP surface serves only a built viewer and explicitly selected experiment data. */
export async function serveReviewDirectory(
	options: ReviewOptions & { assetsDirectory: string },
): Promise<ReviewServer> {
	options.signal?.throwIfAborted();
	const directory = resolve(options.directory);
	await checkDirectory(directory, options.allowMissing);
	if (
		!Number.isInteger(options.port ?? 0) ||
		(options.port ?? 0) < 0 ||
		(options.port ?? 0) > 65535
	)
		throw new Error('Review port must be an integer from 0 to 65535.');
	const token = randomUUID();
	const app = express();
	app.disable('x-powered-by');
	let origin = '';
	app.use((req, res, next) => {
		res.setHeader('Cache-Control', 'no-store');
		res.setHeader('Referrer-Policy', 'no-referrer');
		res.setHeader('X-Content-Type-Options', 'nosniff');
		if (
			`http://${req.headers.host}` !== origin ||
			(req.headers.origin && req.headers.origin !== origin)
		) {
			res.status(403).json({ error: 'Local review requests only.' });
			return;
		}
		next();
	});
	app.get('/api/review', (req, res) => {
		const supplied = Buffer.from(req.headers.authorization ?? '');
		const expected = Buffer.from(`Bearer ${token}`);
		if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
			res.status(403).json({ error: 'Open the review URL printed by hanabi-bench.' });
			return;
		}
		if (req.query.game !== undefined && typeof req.query.game !== 'string') {
			res.status(400).json({ error: 'Expected a single game ID.' });
			return;
		}
		void readReviewSnapshot(directory, req.query.game).then(
			(snapshot) => res.json(snapshot),
			(error: unknown) =>
				res
					.status(errorMessage(error) === 'Unknown review game.' ? 404 : 500)
					.json({ error: errorMessage(error) }),
		);
	});
	app.use('/api', (_req, res) => {
		res.status(404).json({ error: 'Unknown review endpoint.' });
	});
	app.use(express.static(options.assetsDirectory, { index: 'bench.html', dotfiles: 'deny' }));
	app.use((_req, res) => {
		res.status(404).end();
	});
	const server = createServer(app);
	await new Promise<void>((success, failure) => {
		server.once('error', failure);
		server.listen(options.port ?? 0, '127.0.0.1', () => {
			server.removeListener('error', failure);
			success();
		});
	});
	const address = server.address();
	if (!address || typeof address === 'string') throw new Error('Review server has no TCP address.');
	origin = `http://127.0.0.1:${address.port}`;
	const closed = new Promise<void>((done) => server.once('close', done));
	let closing: Promise<void> | undefined;
	const handle: ReviewServer = {
		url: `${origin}/#token=${token}`,
		closed,
		close: () =>
			(closing ??= new Promise<void>((done, reject) => {
				server.close((error) => (error ? reject(error) : done()));
				server.closeAllConnections();
			})),
	};
	const abort = () => {
		void handle.close();
	};
	options.signal?.addEventListener('abort', abort, { once: true });
	void closed.then(() => options.signal?.removeEventListener('abort', abort));
	if (options.signal?.aborted) {
		await handle.close();
		options.signal.throwIfAborted();
	}
	return handle;
}

async function openBrowser(url: string): Promise<void> {
	const executable =
		process.platform === 'darwin'
			? '/usr/bin/open'
			: process.platform === 'win32'
				? 'explorer.exe'
				: 'xdg-open';
	const args = process.platform === 'darwin' ? ['-a', 'Google Chrome', url] : [url];
	await new Promise<void>((success, failure) => {
		const child = spawn(executable, args, { stdio: 'ignore' });
		child.once('error', failure);
		child.once('close', (code) =>
			code === 0 ? success() : failure(new Error('Browser could not be opened.')),
		);
	});
}

export async function startReviewServer(options: ReviewOptions): Promise<ReviewServer> {
	options.signal?.throwIfAborted();
	await checkDirectory(resolve(options.directory), options.allowMissing);
	const assetsDirectory = await mkdtemp(join(tmpdir(), 'hanabi-bench-review-'));
	try {
		const webRoot = fileURLToPath(new URL('../../../web/', import.meta.url));
		const require = createRequire(join(webRoot, 'package.json'));
		const vite = join(dirname(require.resolve('vite/package.json')), 'bin', 'vite.js');
		await promisify(execFile)(
			process.execPath,
			[
				vite,
				'build',
				'--config',
				'vite.bench.config.ts',
				'--outDir',
				assetsDirectory,
				'--emptyOutDir',
			],
			{
				cwd: webRoot,
				maxBuffer: 4 * 1024 * 1024,
				signal: options.signal,
			},
		);
		options.signal?.throwIfAborted();
		const server = await serveReviewDirectory({ ...options, assetsDirectory });
		const closed = server.closed.then(() => rm(assetsDirectory, { recursive: true, force: true }));
		if (options.open !== false) {
			options.signal?.throwIfAborted();
			await openBrowser(server.url).catch((error: unknown) => {
				console.error(`Open the printed Review URL in your browser: ${errorMessage(error)}`);
			});
		}
		return {
			...server,
			closed,
			close: async () => {
				await server.close();
				await closed;
			},
		};
	} catch (error) {
		await rm(assetsDirectory, { recursive: true, force: true });
		throw error;
	}
}
