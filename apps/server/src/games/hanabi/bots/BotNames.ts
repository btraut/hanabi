import { randomInt } from 'node:crypto';

export const BOT_NAMES = [
	'WALL-E',
	'EVE',
	'R2-D2',
	'C-3PO',
	'BB-8',
	'Bender',
	'Data',
	'Marvin',
	'Rosie',
	'Baymax',
	'Johnny 5',
	'Optimus Prime',
] as const;

export function chooseBotName(existingNames: readonly string[]): string {
	const used = new Set(existingNames.map((name) => name.trim().toLowerCase()));
	const available = BOT_NAMES.filter((name) => !used.has(name.toLowerCase()));
	if (available.length === 0) throw new Error('No bot names are available.');
	return available[randomInt(available.length)];
}
