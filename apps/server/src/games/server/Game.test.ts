import { describe, expect, it, vi } from 'vitest';
import Game from './Game.js';
import { SaveGameDelegate } from './GameStore.js';

class TestGame extends Game {
	public value = 0;

	public get title(): string {
		return 'Test';
	}

	public serialize(): string {
		return String(this.value);
	}

	public update(value: number): void {
		this.value = value;
		this._update();
	}
}

function createDelegate(saveGame: SaveGameDelegate['saveGame']): SaveGameDelegate {
	return {
		saveGame,
		deleteGame: vi.fn(),
	};
}

describe('Game persistence queue', () => {
	it('coalesces synchronous updates into one save of the final state', async () => {
		const savedValues: string[] = [];
		const game = new TestGame(
			'creator',
			createDelegate((savedGame) => {
				savedValues.push(savedGame.serialize() ?? '');
				return Promise.resolve();
			}),
		);

		game.update(1);
		game.update(2);
		game.update(3);
		await game.flushSaves();

		expect(savedValues).toEqual(['3']);
	});

	it('runs one final save when updates arrive during an in-flight save', async () => {
		let releaseFirstSave: (() => void) | undefined;
		let firstSaveStarted: (() => void) | undefined;
		const firstSave = new Promise<void>((resolve) => {
			releaseFirstSave = resolve;
		});
		const started = new Promise<void>((resolve) => {
			firstSaveStarted = resolve;
		});
		const savedValues: string[] = [];
		const game = new TestGame(
			'creator',
			createDelegate(async (savedGame) => {
				savedValues.push(savedGame.serialize() ?? '');
				if (savedValues.length === 1) {
					firstSaveStarted?.();
					await firstSave;
				}
			}),
		);

		game.update(1);
		await started;
		game.update(2);
		game.update(3);
		releaseFirstSave?.();
		await game.flushSaves();

		expect(savedValues).toEqual(['1', '3']);
	});

	it('flushes an already requested save after saving is stopped', async () => {
		const saveGame = vi.fn(() => Promise.resolve());
		const game = new TestGame('creator', createDelegate(saveGame));

		game.update(1);
		game.stopSaving();
		game.update(2);
		await game.flushSaves();

		expect(saveGame).toHaveBeenCalledTimes(1);
	});
});
