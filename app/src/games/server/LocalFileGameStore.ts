import Game from 'app/src/games/server/Game';
import { GameStore } from 'app/src/games/server/GameStore';
import { existsSync, promises } from 'fs';

export default class LocalFileGameStore implements GameStore {
	private _savedGamesPath: string;

	constructor(savedGamesPath: string) {
		this._savedGamesPath = savedGamesPath;
	}

	public async saveGame(game: Game): Promise<void> {
		const { writeFile, mkdir } = promises;

		const serialized = game.serialize();
		const path = `${this._savedGamesPath}/${game.title}/${game.id}`;

		if (!existsSync(this._savedGamesPath)) {
			await mkdir(this._savedGamesPath);
		}

		if (!existsSync(`${this._savedGamesPath}/${game.title}`)) {
			await mkdir(`${this._savedGamesPath}/${game.title}`);
		}

		if (serialized !== null) {
			await writeFile(path, serialized);
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
				const gameFileData = await readFile(`${this._savedGamesPath}/${title}/${gameFile}`, 'utf8');
				gameData[title].push(gameFileData);
			}
		}

		return gameData;
	}
}
