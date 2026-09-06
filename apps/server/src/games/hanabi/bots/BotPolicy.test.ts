import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { generateHanabiGameData, HANABI_RULE_SETS } from '@hanabi/shared';
import {
	createBotPolicy,
	createRoundBotPolicy,
	DEFAULT_BOT_MODEL,
	isBotPolicy,
	migrateBotPolicy,
} from './BotPolicy.js';
import { getBotRules } from './BotRules.js';

describe('bot policies', () => {
	it('loads editable conventions alongside the fixed player contract', () => {
		const policy = createBotPolicy();
		expect(policy.model).toBe(DEFAULT_BOT_MODEL);
		expect(policy.reasoningEffort).toBe('high');
		expect(policy.instructions).toContain('Your own card faces and the undealt deck are unknown');
		expect(policy.instructions).toContain('# Hanabi bot conventions');
		expect(isBotPolicy(policy)).toBe(true);
	});

	it('supports empty and custom coaching instructions without changing a saved snapshot', () => {
		const first = createBotPolicy('model-a', 'Interpret a fresh 1 clue as a play clue.');
		const saved: unknown = JSON.parse(JSON.stringify(first));
		const second = createBotPolicy('model-a', 'Keep the oldest unclued card as the discard.');
		const empty = createBotPolicy('model-a', '');
		expect(first).toEqual(saved);
		expect(second.hash).not.toBe(first.hash);
		expect(empty.instructions).toContain('Select one action from legalActions');
		expect(empty.instructions).not.toContain('# Hanabi bot conventions');
		expect(isBotPolicy(saved)).toBe(true);
	});

	it('includes the model in the stable policy hash and rejects corrupted saved policies', () => {
		const policy = createBotPolicy('model-a', 'Coaching');
		expect(policy.hash).toBe(createBotPolicy('model-a', 'Coaching').hash);
		expect(policy.hash).not.toBe(createBotPolicy('model-b', 'Coaching').hash);
		expect(isBotPolicy({ ...policy, model: 'model-b' })).toBe(false);
		expect(isBotPolicy({ ...policy, instructions: 'replacement' })).toBe(false);
		expect(isBotPolicy({ model: 'model-a', instructions: 'Coaching' })).toBe(false);
		expect(isBotPolicy(null)).toBe(false);
	});

	it('snapshots effort in the policy hash and keeps legacy saved policies readable', () => {
		const policy = createBotPolicy('gpt-6-astra', 'Coaching', 'xhigh');
		expect(policy.hash).not.toBe(createBotPolicy('gpt-6-astra', 'Coaching', 'high').hash);
		expect(isBotPolicy({ ...policy, reasoningEffort: 'high' })).toBe(false);
		expect(isBotPolicy({ ...policy, reasoningEffort: 'invalid' })).toBe(false);
		expect(isBotPolicy(JSON.parse(JSON.stringify(policy)))).toBe(true);
		const legacy = { model: 'gpt-5.4-mini-2026-03-17', instructions: 'Saved instructions' };
		expect(
			isBotPolicy({
				...legacy,
				hash: createHash('sha256').update(JSON.stringify(legacy)).digest('hex'),
			}),
		).toBe(true);
	});

	it('bounds operator-provided policy size', () => {
		expect(() => createBotPolicy(' ')).toThrow('model');
		expect(() => createBotPolicy('model', 'x'.repeat(64_001))).toThrow('64000');
	});
});

describe('round bot policies', () => {
	it.each(HANABI_RULE_SETS)(
		'snapshots only active %s rules and keeps the configured model and effort',
		(ruleSet) => {
			const game = generateHanabiGameData({ ruleSet });
			const base = createBotPolicy('gpt-6-astra', 'Custom team coaching.', 'high');
			const policy = createRoundBotPolicy(base, game);
			expect(policy).toMatchObject({
				model: 'gpt-6-astra',
				reasoningEffort: 'high',
				contractVersion: 2,
				arrangementAfterClue: true,
				conventions: 'Custom team coaching.',
				rules: getBotRules(game),
			});
			expect(policy.instructions).toContain('Custom team coaching.');
			for (const color of ['purple', 'rainbow', 'black'] as const) {
				expect(policy.instructions.toLowerCase().includes(color)).toBe(
					policy.rules?.suits.some((suit) => suit.color === color),
				);
			}
			expect(isBotPolicy(JSON.parse(JSON.stringify(policy)))).toBe(true);
			expect(base).not.toHaveProperty('contractVersion');
		},
	);

	it('makes optional clue arrangements consistent with dragging and hashes every option', () => {
		const game = generateHanabiGameData();
		const source = createBotPolicy();
		const base = createRoundBotPolicy(source, game);
		const disabled = createRoundBotPolicy(source, { ...game, allowDragging: false });
		expect(disabled.arrangementAfterClue).toBe(false);
		expect(disabled.instructions).toContain('Arrangement opportunities after clues are disabled');
		expect(base.instructions).toContain('This is optional: you may set cards aside');
		expect(base.reflectionAfterAction).toBe(true);
		expect(disabled.reflectionAfterAction).toBe(true);
		expect(base.instructions).toContain('After your own play or discard');
		expect(disabled.instructions).toContain(
			'Apply reservation and discard-queue conventions logically',
		);
		expect(disabled.instructions).toContain('Return arrangement null on every opportunity');
		expect(isBotPolicy({ ...base, reflectionAfterAction: undefined })).toBe(false);
		expect(isBotPolicy({ ...base, reflectionAfterAction: false })).toBe(false);
		for (const field of ['showNotes', 'criticalGameOver', 'allowDragging'] as const) {
			expect(createRoundBotPolicy(source, { ...game, [field]: false }).hash).not.toBe(base.hash);
		}
		expect(createRoundBotPolicy(source, { ...game, ruleSet: 'rainbow' }).hash).not.toBe(base.hash);
		expect(
			createRoundBotPolicy(createBotPolicy('gpt-6-astra', 'Revised coaching'), game).hash,
		).not.toBe(base.hash);
		expect(isBotPolicy({ ...base, arrangementAfterClue: false })).toBe(false);
		expect(isBotPolicy({ ...base, conventionsVersion: 'corrupted' })).toBe(false);
		expect(isBotPolicy({ ...base, conventions: 'corrupted' })).toBe(false);
		expect(isBotPolicy({ ...base, rules: { ...base.rules, allowDragging: false } })).toBe(false);
	});

	it('recomposes from coaching after JSON serialization without carrying legacy variant text', () => {
		const source = createBotPolicy('model', 'Only this coaching.');
		const serialized: unknown = JSON.parse(JSON.stringify(source));
		if (!isBotPolicy(serialized)) throw new Error('Expected a valid saved startup policy.');
		const fresh = createRoundBotPolicy(serialized, generateHanabiGameData());
		expect(fresh.conventions).toBe('Only this coaching.');
		expect(fresh.instructions).not.toContain('Black powder');
		expect(fresh.instructions).not.toContain('Rainbow');
		expect(isBotPolicy(source)).toBe(true);
		const hash = source.hash;
		createRoundBotPolicy(source, generateHanabiGameData({ ruleSet: 'rainbow' }));
		expect(source.hash).toBe(hash);
	});

	it('preserves the v2 snapshot and hash when storage reorders object keys', () => {
		const policy = createRoundBotPolicy(createBotPolicy(), generateHanabiGameData());
		const serialized = JSON.stringify(policy, (_key, value: unknown) =>
			value && typeof value === 'object' && !Array.isArray(value)
				? Object.fromEntries(Object.entries(value).reverse())
				: value,
		);
		expect(isBotPolicy(JSON.parse(serialized))).toBe(true);
		expect(policy.instructions).toContain(policy.conventions);
		expect(policy.instructions).toContain('not private chain-of-thought');
	});
});

describe('retired scratchpad policies', () => {
	it('does not include scratchpad fields or instructions in new policies', () => {
		for (const allowDragging of [true, false]) {
			const policy = createRoundBotPolicy(
				createBotPolicy(),
				generateHanabiGameData({ allowDragging }),
			);
			expect(policy).not.toHaveProperty('notepadVersion');
			expect(policy.instructions).not.toMatch(
				/notepad|scratchpad|notes field|explanation and notes/i,
			);
			expect(migrateBotPolicy(policy)).toBe(policy);
		}
	});

	it('validates legacy identity before removing scratchpad instructions and rehashing', () => {
		const policy = createRoundBotPolicy(
			createBotPolicy('model', 'Custom coaching.'),
			generateHanabiGameData(),
		);
		const { hash: _hash, ...identity } = policy;
		const legacy = {
			...identity,
			notepadVersion: 1,
			instructions: policy.instructions.replace(
				'\n\n## Coaching instructions',
				'\n\n## Private notepad\n\nReturn a notes field alongside actionId, arrangement, and explanation.\n\n## Coaching instructions',
			),
		};
		const saved = {
			...legacy,
			hash: createHash('sha256')
				.update(
					JSON.stringify(legacy, (_key, value: unknown) =>
						value && typeof value === 'object' && !Array.isArray(value)
							? Object.fromEntries(
									Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
								)
							: value,
					),
				)
				.digest('hex'),
		};
		expect(isBotPolicy(saved)).toBe(true);
		expect(isBotPolicy({ ...saved, instructions: 'Corrupt instructions' })).toBe(false);
		const migrated = migrateBotPolicy(saved);
		expect(migrated).toEqual(policy);
		expect(migrated.hash).not.toBe(saved.hash);
		expect(isBotPolicy(migrated)).toBe(true);
		expect(saved).toHaveProperty('notepadVersion', 1);
	});
});
