import { execFileSync } from 'node:child_process';
import { constants, copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const worktrees = execFileSync('git', ['worktree', 'list', '--porcelain', '-z'], {
	cwd: root,
	encoding: 'utf8',
});
const primaryRoot = worktrees.split('\0')[0].replace(/^worktree /, '');

if (primaryRoot === root) {
	console.log('Primary checkout: keeping local environment files.');
} else {
	for (const file of ['.env', 'apps/server/.env']) {
		const destination = resolve(root, file);
		mkdirSync(dirname(destination), { recursive: true });
		try {
			copyFileSync(resolve(primaryRoot, file), destination, constants.COPYFILE_EXCL);
			console.log(`Copied ${file} from the primary checkout.`);
		} catch (error) {
			if (error.code === 'EEXIST') {
				console.log(`Keeping existing ${file}.`);
			} else if (error.code === 'ENOENT') {
				console.log(`Skipping ${file}: missing from the primary checkout.`);
			} else {
				throw error;
			}
		}
	}
}
