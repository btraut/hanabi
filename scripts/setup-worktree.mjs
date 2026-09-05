import { execFileSync } from 'node:child_process';
import { constants, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const worktrees = execFileSync('git', ['worktree', 'list', '--porcelain', '-z'], {
	cwd: root,
	encoding: 'utf8',
});
const primaryRoot = worktrees.split('\0')[0].replace(/^worktree /, '');

if (primaryRoot === root) {
	console.log('Primary checkout: keeping local .env.');
} else {
	try {
		copyFileSync(resolve(primaryRoot, '.env'), resolve(root, '.env'), constants.COPYFILE_EXCL);
		console.log('Copied .env from the primary checkout.');
	} catch (error) {
		if (error.code === 'EEXIST') {
			console.log('Keeping existing .env.');
		} else if (error.code === 'ENOENT') {
			console.log('Skipping .env: missing from the primary checkout.');
		} else {
			throw error;
		}
	}
}
