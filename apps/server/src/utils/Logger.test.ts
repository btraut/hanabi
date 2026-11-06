import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

function logInServerProcess(script: string): string[] {
	const moduleUrl = new URL('./Logger.ts', import.meta.url).href;
	return execFileSync(
		process.execPath,
		[
			'--import',
			'tsx',
			'--input-type=module',
			'--eval',
			`import Logger from ${JSON.stringify(moduleUrl)};\n${script}`,
		],
		{ encoding: 'utf8' },
	)
		.trim()
		.split('\n');
}

describe('server diagnostic output', () => {
	it('writes searchable single-line JSON and keeps verbose socket traffic opt-in', () => {
		const lines = logInServerProcess(`
			Logger.init();
			Logger.event('game.player_joined', {
				gameCode: 'wn5z7p', userId: 'new-player',
				playerName: 'weish\\nsecond line',
				roster: [{ id: 'new-player', name: 'weish\\nsecond line', connected: true }],
			});
			Logger.event('socket.message_received', {socketId: 'hidden-debug'}, 'debug');
			Logger.init('debug');
			Logger.event('socket.message_received', {socketId: 'socket-one'}, 'debug');
		`);
		expect(lines).toHaveLength(2);
		expect(lines[0].trim().split('\n')).toHaveLength(1);
		const timestampMatcher: unknown = expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/);
		expect(JSON.parse(lines[0])).toMatchObject({
			event: 'game.player_joined',
			level: 'info',
			timestamp: timestampMatcher,
			gameCode: 'wn5z7p',
			userId: 'new-player',
			playerName: 'weish\nsecond line',
			roster: [{ id: 'new-player', name: 'weish\nsecond line', connected: true }],
		});

		expect(JSON.parse(lines[1])).toMatchObject({
			event: 'socket.message_received',
			level: 'debug',
			socketId: 'socket-one',
		});
	});

	it('preserves error stacks for existing server failure logs', () => {
		const lines = logInServerProcess(`
			Logger.init();
			Logger.error('Failed to save game.', new Error('Store unavailable'));
		`);
		const stackMatcher: unknown = expect.stringContaining('Error: Store unavailable\n');
		expect(JSON.parse(lines[0])).toMatchObject({
			level: 'error',
			message: 'Failed to save game. Error: Store unavailable',
			errors: [
				{
					name: 'Error',
					message: 'Store unavailable',
					stack: stackMatcher,
				},
			],
		});
	});
});
