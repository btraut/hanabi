import Game from './Game.js';
import { GameStore } from './GameStore.js';
import { randomUUID } from 'node:crypto';
import { existsSync, promises } from 'node:fs';

export default class LocalFileGameStore implements GameStore {
	private _savedGamesPath: string;

	constructor(savedGamesPath: string) {
		this._savedGamesPath = savedGamesPath;
	}

	public async close(): Promise<void> {}

	public async saveGame(game: Game): Promise<void> {
		const { writeFile, mkdir, rename, rm } = promises;

		const serialized = game.serialize();
		if (serialized === null) {
			return;
		}

		const gameDirectory = `${this._savedGamesPath}/${game.title}`;
		const path = `${gameDirectory}/${game.id}`;
		const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;

		await mkdir(gameDirectory, { recursive: true });
		try {
			await writeFile(temporaryPath, serialized);
			await rename(temporaryPath, path);
		} finally {
			await rm(temporaryPath, { force: true });
		}
	}

	public async deleteGame(game: Game): Promise<void> {
		const { rm } = promises;

		const path = `${this._savedGamesPath}/${game.title}/${game.id}`;

		if (existsSync(path)) {
			await rm(path);
		}
	}

	public async loadGameData(): Promise<{ [title: string]: string[] }> {
		const { lstat, readdir, readFile } = promises;

		const gameData: { [title: string]: string[] } = {};

		if (!existsSync(this._savedGamesPath)) {
			return gameData;
		}

		const gameDirs = await readdir(this._savedGamesPath);

		for (const title of gameDirs) {
			const stat = await lstat(`${this._savedGamesPath}/${title}`);

			if (!stat.isDirectory()) {
				continue;
			}

			gameData[title] = [];

			const gameFiles = await readdir(`${this._savedGamesPath}/${title}`);

			for (const gameFile of gameFiles) {
				if (gameFile.endsWith('.tmp')) {
					continue;
				}
				const gameFileData = await readFile(`${this._savedGamesPath}/${title}/${gameFile}`, 'utf8');
				gameData[title].push(gameFileData);
			}
		}

		return gameData;
	}
}
