import {
	doesHanabiTileMatchClue,
	getHanabiClueColors,
	getHanabiCompletionTileCount,
	getHanabiFireworkSequence,
	getHanabiMaxScore,
	getHanabiRuleSetColors,
	getHanabiTileCopyCount,
	HANABI_CLUE_COLORS,
	HANABI_TILE_COLORS,
	HANABI_MAX_CLUES,
	HANABI_MAX_LIVES,
	isHanabiRuleSet,
	type HanabiGameData,
	type HanabiTileNumber,
} from '@hanabi/shared';

export type BotRuleOptions = Pick<
	HanabiGameData,
	'ruleSet' | 'allowDragging' | 'showNotes' | 'criticalGameOver'
>;

/** The prompt and observation share this descriptor; no private game data is read. */
export function getBotRules(options: BotRuleOptions) {
	const colorClues = [...getHanabiClueColors(options.ruleSet)];
	return {
		ruleSet: options.ruleSet,
		allowDragging: options.allowDragging,
		showNotes: options.showNotes,
		criticalGameOver: options.criticalGameOver,
		maxClues: HANABI_MAX_CLUES,
		maxLives: HANABI_MAX_LIVES,
		maxScore: getHanabiMaxScore(options.ruleSet),
		completionTileCount: getHanabiCompletionTileCount(options.ruleSet),
		colorClues,
		suits: getHanabiRuleSetColors(options.ruleSet).map((color) => ({
			color,
			playSequence: [...getHanabiFireworkSequence(color)],
			matchingColorClues: colorClues.filter((clueColor) =>
				doesHanabiTileMatchClue({ id: 'rules', color, number: 1 }, options.ruleSet, {
					color: clueColor,
				}),
			),
			copies: ([1, 2, 3, 4, 5] as const).map((number: HanabiTileNumber) => ({
				number,
				count: getHanabiTileCopyCount(color, number),
			})),
		})),
	};
}

export type BotRules = ReturnType<typeof getBotRules>;

function hasKeys(value: object, keys: readonly string[]): boolean {
	const actual = Object.keys(value);
	return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function isPositiveCount(value: unknown): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= 100;
}

/** Validate the recorded descriptor without replacing it with current engine rules. */
export function isBotRules(value: unknown): value is BotRules {
	if (!value || typeof value !== 'object') return false;
	const rules = value as Partial<BotRules>;
	return (
		hasKeys(value, [
			'ruleSet',
			'allowDragging',
			'showNotes',
			'criticalGameOver',
			'maxClues',
			'maxLives',
			'maxScore',
			'completionTileCount',
			'colorClues',
			'suits',
		]) &&
		isHanabiRuleSet(rules.ruleSet) &&
		typeof rules.allowDragging === 'boolean' &&
		typeof rules.showNotes === 'boolean' &&
		typeof rules.criticalGameOver === 'boolean' &&
		isPositiveCount(rules.maxClues) &&
		isPositiveCount(rules.maxLives) &&
		isPositiveCount(rules.maxScore) &&
		isPositiveCount(rules.completionTileCount) &&
		Array.isArray(rules.colorClues) &&
		rules.colorClues.length > 0 &&
		new Set(rules.colorClues).size === rules.colorClues.length &&
		rules.colorClues.every((color) => (HANABI_CLUE_COLORS as readonly unknown[]).includes(color)) &&
		Array.isArray(rules.suits) &&
		rules.suits.length > 0 &&
		rules.suits.length <= HANABI_TILE_COLORS.length &&
		new Set(rules.suits.map((suit) => suit?.color)).size === rules.suits.length &&
		rules.suits.every(
			(suit) =>
				suit &&
				typeof suit === 'object' &&
				hasKeys(suit, ['color', 'playSequence', 'matchingColorClues', 'copies']) &&
				(HANABI_TILE_COLORS as readonly unknown[]).includes(suit.color) &&
				Array.isArray(suit.playSequence) &&
				suit.playSequence.length === 5 &&
				new Set(suit.playSequence).size === 5 &&
				suit.playSequence.every((rank) => [1, 2, 3, 4, 5].includes(rank)) &&
				Array.isArray(suit.matchingColorClues) &&
				new Set(suit.matchingColorClues).size === suit.matchingColorClues.length &&
				suit.matchingColorClues.every((color) => rules.colorClues!.includes(color)) &&
				Array.isArray(suit.copies) &&
				suit.copies.length === 5 &&
				new Set(suit.copies.map((copy) => copy?.number)).size === 5 &&
				suit.copies.every(
					(copy) =>
						copy &&
						typeof copy === 'object' &&
						hasKeys(copy, ['number', 'count']) &&
						[1, 2, 3, 4, 5].includes(copy.number) &&
						isPositiveCount(copy.count),
				),
		)
	);
}

export function renderBotRules(rules: BotRules): string {
	const lines = [
		`Mode: ${rules.ruleSet}. Suits: ${rules.suits.map(({ color }) => color).join(', ')}. Available color clues: ${rules.colorClues.join(', ')}. Maximum score: ${rules.maxScore}.`,
		'On your turn, choose exactly one supplied play, discard, or clue action. Plays succeed only for the next unbuilt number of that suit; duplicates fail. A failed play discards the card and loses one life. Zero lives ends the game.',
		`Start with ${rules.maxLives} lives and up to ${rules.maxClues} clue tokens. A discard restores one clue and is forbidden at ${rules.maxClues} clues. A clue costs one token, must touch at least one card in another player's hand, and identifies every matching card in that hand. Number clues match the stated number. Untouched cards present at that clue cannot match it. Newly drawn cards inherit none of those constraints.`,
		`Completing any suit restores one clue up to ${rules.maxClues}. After playing or discarding, draw a replacement if available. New cards join the right end of the upper row. Drawing the last card starts one final turn per player; remainingTurns is the authoritative countdown. Completing all ${rules.completionTileCount} required plays also ends the game.`,
	];
	for (const suit of rules.suits) {
		lines.push(
			`${suit.color}: build ${suit.playSequence.join(' → ')}. Copies by rank: ${suit.copies.map(({ number, count }) => `${number}:${count}`).join(', ')}.`,
		);
		if (suit.color === 'rainbow') {
			lines.push(
				`Rainbow matches every available color clue (${suit.matchingColorClues.join(', ')}); Rainbow itself is not a permitted color clue. Matching a color clue therefore does not establish that ordinary suit.`,
			);
		}
		if (suit.color === 'black') {
			lines.push(
				'Black Powder cards match number clues only and never color clues. Its completion card is 1. Score is max(0, colored cards played − (5 − Black cards played)); each missing Black play is a penalty, and Black does not add to the colored-score maximum.',
			);
		}
		if (suit.color === 'purple') {
			lines.push('Purple is an ordinary suit with its own purple color clue.');
		}
	}
	lines.push(
		rules.criticalGameOver
			? 'Critical game over is enabled: discarding or failing to play the last available copy of a suit/rank not already built immediately ends the game, even with lives remaining.'
			: 'Critical game over is disabled: losing the last unbuilt copy does not itself end the game. Failed plays still lose a life.',
		rules.allowDragging
			? 'Card dragging is enabled. Players may rearrange their own cards without consuming a turn, including off-turn. The upper row stays densely packed from the left; the lower area permits free placement and overlap.'
			: 'Card dragging is disabled. Arrangement must be null; players cannot rearrange their cards.',
		rules.showNotes
			? 'Visible card notes are enabled and record positive clue marks. Full literal clue knowledge also includes negative evidence from history.'
			: 'Visible card notes are disabled. Clue events still convey positive and negative information; use the complete supplied history and literal knowledge.',
	);
	return lines.join('\n\n');
}
