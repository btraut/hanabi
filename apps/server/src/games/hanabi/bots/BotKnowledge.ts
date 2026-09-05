import {
	doesHanabiTileMatchClue,
	getHanabiRuleSetColors,
	type HanabiRuleSet,
	type HanabiTile,
	type HanabiTileNumber,
} from '@hanabi/shared';
import type { BotClue } from './BotHistory.js';

export type BotIdentity = Pick<HanabiTile, 'color' | 'number'>;

export interface BotClueEvidence {
	eventId: string;
	clue: BotClue;
}

export interface BotLiteralEvidence {
	positive: BotClueEvidence[];
	negative: BotClueEvidence[];
}

export interface BotKnowledgeClue {
	eventId: string;
	clue: BotClue;
	hand: { tileId: string }[];
	touchedTileIds: string[];
	untouchedTileIds: string[];
}

export interface BotRemainingIdentity extends BotIdentity {
	totalCopies: number;
	playedCopies: number;
	discardedCopies: number;
	remainingCopies: number;
}

export function botIdentityKey(identity: BotIdentity): string {
	return `${identity.color}:${identity.number}`;
}

function copyClue(clue: BotClue): BotClue {
	return clue.type === 'color'
		? { type: 'color', value: clue.value }
		: { type: 'number', value: clue.value };
}

/** Inputs contain projected clue facts only, never the server's hidden card dictionary. */
export function literalBotIdentities(
	ruleSet: HanabiRuleSet,
	evidence: BotLiteralEvidence,
): BotIdentity[] {
	const identities = getHanabiRuleSetColors(ruleSet).flatMap((color) =>
		([1, 2, 3, 4, 5] as const).map((number) => ({ color, number })),
	);
	const matches = (identity: BotIdentity, clue: BotClue) =>
		doesHanabiTileMatchClue(
			{ id: 'candidate', ...identity },
			ruleSet,
			clue.type === 'color' ? { color: clue.value } : { number: clue.value },
		);
	return identities.filter(
		(identity) =>
			evidence.positive.every(({ clue }) => matches(identity, clue)) &&
			evidence.negative.every(({ clue }) => !matches(identity, clue)),
	);
}

export function botClueEvidence(
	tileId: string,
	clues: readonly BotKnowledgeClue[],
): BotLiteralEvidence {
	const positive: BotClueEvidence[] = [];
	const negative: BotClueEvidence[] = [];
	for (const event of clues) {
		const item = { eventId: event.eventId, clue: copyClue(event.clue) };
		if (event.touchedTileIds.includes(tileId)) positive.push(item);
		else if (event.untouchedTileIds.includes(tileId)) negative.push(item);
	}
	return { positive, negative };
}

/** Record factual novelty without treating the sender's intent as a constraint. */
export function botClueChanges(
	ruleSet: HanabiRuleSet,
	event: BotKnowledgeClue,
	priorClues: readonly BotKnowledgeClue[],
) {
	return event.hand.map(({ tileId }) => {
		const evidence = botClueEvidence(tileId, priorClues);
		const before = literalBotIdentities(ruleSet, evidence);
		const after = literalBotIdentities(ruleSet, botClueEvidence(tileId, [...priorClues, event]));
		const remaining = new Set(after.map(botIdentityKey));
		return {
			tileId,
			touched: event.touchedTileIds.includes(tileId),
			firstEvidence: evidence.positive.length + evidence.negative.length === 0,
			firstPositiveClue: event.touchedTileIds.includes(tileId) && evidence.positive.length === 0,
			newConstraint: after.length < before.length,
			excludedIdentities: before.filter((identity) => !remaining.has(botIdentityKey(identity))),
		};
	});
}

export function botPublicRemainingCopies(
	suits: readonly {
		color: HanabiTile['color'];
		copies: readonly { number: number; count: number }[];
	}[],
	played: readonly BotIdentity[],
	discarded: readonly BotIdentity[],
): BotRemainingIdentity[] {
	const count = (cards: readonly BotIdentity[], identity: BotIdentity) =>
		cards.filter((card) => botIdentityKey(card) === botIdentityKey(identity)).length;
	return suits.flatMap(({ color, copies }) =>
		copies.map(({ number, count: totalCopies }) => {
			const identity = { color, number: number as HanabiTileNumber };
			const playedCopies = count(played, identity);
			const discardedCopies = count(discarded, identity);
			return {
				...identity,
				totalCopies,
				playedCopies,
				discardedCopies,
				remainingCopies: Math.max(0, totalCopies - playedCopies - discardedCopies),
			};
		}),
	);
}

/** Other visible hands may narrow this observer's hand, never a teammate's belief matrix. */
export function botPossibleIdentities(
	ruleSet: HanabiRuleSet,
	evidence: BotLiteralEvidence,
	remainingCopies: readonly BotRemainingIdentity[],
	visibleOtherCards: readonly BotIdentity[] = [],
): BotIdentity[] {
	const counts = new Map(
		remainingCopies.map((identity) => [botIdentityKey(identity), identity.remainingCopies]),
	);
	for (const visible of visibleOtherCards) {
		const key = botIdentityKey(visible);
		counts.set(key, Math.max(0, (counts.get(key) ?? 0) - 1));
	}
	return literalBotIdentities(ruleSet, evidence).filter(
		(identity) => (counts.get(botIdentityKey(identity)) ?? 0) > 0,
	);
}
