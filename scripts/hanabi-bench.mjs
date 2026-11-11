#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { tsImport } from 'tsx/esm/api';

try {
	const { main } = await tsImport('../apps/server/src/bench/cli.ts', {
		parentURL: import.meta.url,
		tsconfig: fileURLToPath(new URL('../tsconfig.base.json', import.meta.url)),
	});
	process.exitCode = await main();
} catch (error) {
	console.error(`Hanabi Bench: ${error instanceof Error ? error.message : String(error)}`);
	process.exitCode = 1;
}
