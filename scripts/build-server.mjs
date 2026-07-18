import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

await build({
	entryPoints: [path.join(workspaceRoot, 'apps/server/src/main.ts')],
	outfile: path.join(workspaceRoot, 'dist/apps/server/main.js'),
	bundle: true,
	platform: 'node',
	format: 'esm',
	target: 'node24',
	sourcemap: true,
	banner: {
		js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);',
	},
	logLevel: 'info',
});
