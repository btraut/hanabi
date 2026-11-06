import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBotPolicy } from './BotPolicy.js';
import { BotRuntime } from './BotRuntime.js';
import type { BotDecisionProvider } from './OpenAiBot.js';

function runtime(limits: ConstructorParameters<typeof BotRuntime>[2] = {}) {
	const provider: BotDecisionProvider = { chooseAction: vi.fn() };
	return new BotRuntime(provider, createBotPolicy('test-model', ''), {
		maxConcurrent: 2,
		...limits,
	});
}

function reserved(
	value: ReturnType<BotRuntime['reserve']> | ReturnType<BotRuntime['reserveCustom']>,
) {
	if (typeof value === 'string') throw new Error(`Expected a reservation, received ${value}.`);
	return value;
}

describe('BotRuntime', () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date('2026-09-04T20:00:00Z'));
	});
	afterEach(() => vi.useRealTimers());

	it('gives result follow-ups a separate short budget', () => {
		const limits = runtime().limits;
		expect(limits).toMatchObject({
			timeoutMs: 120_000,
			maxOutputTokens: 16_384,
			resultTimeoutMs: 5_000,
			resultMaxOutputTokens: 2_048,
		});
		expect(runtime({ resultTimeoutMs: 100, resultMaxOutputTokens: 512 }).limits).toMatchObject({
			resultTimeoutMs: 100,
			resultMaxOutputTokens: 512,
		});
	});

	it('shares concurrency across callers and makes release idempotent', () => {
		const shared = runtime();
		const first = reserved(shared.reserve());
		const second = reserved(shared.reserve());
		expect(shared.reserve()).toBe('busy');
		first.release();
		first.release();
		const third = reserved(shared.reserve());
		expect(shared.reserve()).toBe('busy');
		second.release();
		third.release();
		expect(typeof shared.reserve()).toBe('object');
	});

	it('continues beyond the retired hourly request and token allowances', () => {
		const shared = new BotRuntime({ chooseAction: vi.fn() }, createBotPolicy('test-model', ''));
		for (let request = 0; request < 600; request += 1) {
			reserved(shared.reserve()).release();
		}
	});

	it('caps custom requests across games and retains reservations after release', () => {
		const shared = runtime({ customGlobalMaxTokens: 100, customGlobalMaxAttempts: 3 });
		const usage = { attempts: 0, tokens: 0 };
		reserved(shared.reserveCustom('room-1:round', 60, usage)).release();
		expect(shared.reserveCustom('room-2:round', 41, usage)).toBe('global_budget');
		reserved(shared.reserveCustom('room-2:round', 40, usage)).release();
		expect(shared.reserveCustom('room-3:round', 1, usage)).toBe('global_budget');
		vi.setSystemTime(Date.now() + 3_600_000);
		reserved(shared.reserveCustom('room-3:round', 1, usage)).release();
	});

	it('shares round allowances across result snapshots and restores the persisted baseline', () => {
		const shared = runtime({ customRoundMaxAttempts: 3, customRoundMaxTokens: 100 });
		shared.seedCustomRound('game:round', 1, 50);
		const result = { attempts: 0, tokens: 0 };
		reserved(shared.reserveCustom('game:round', 25, result)).release();
		reserved(shared.reserveCustom('game:round', 25, result)).release();
		expect(shared.reserveCustom('game:round', 0, result)).toBe('round_budget');
		vi.setSystemTime(Date.now() + 3_600_000);
		expect(shared.reserveCustom('game:round', 0, result)).toBe('round_budget');
		const restarted = runtime({ customRoundMaxAttempts: 3 });
		expect(restarted.reserveCustom('game:round', 1, { attempts: 3, tokens: 5 })).toBe(
			'round_budget',
		);
	});

	it('does not charge custom admission when concurrency is unavailable', () => {
		const shared = runtime({ maxConcurrent: 1, customGlobalMaxAttempts: 1 });
		const held = reserved(shared.reserve());
		expect(shared.reserveCustom('game:round', 1, { attempts: 0, tokens: 0 })).toBe('busy');
		held.release();
		reserved(shared.reserveCustom('game:round', 1, { attempts: 0, tokens: 0 })).release();
		expect(shared.reserveCustom('game:round', 1, { attempts: 0, tokens: 0 })).toBe('global_budget');
	});

	it('fails closed without a reviewer and on reviewer errors', async () => {
		await expect(runtime().reviewConventions('host', 'Discard oldest.')).resolves.toMatchObject({
			accepted: false,
		});
		const shared = new BotRuntime(
			{ chooseAction: vi.fn() },
			createBotPolicy(),
			{},
			{
				review: vi.fn().mockRejectedValue(new Error('sensitive provider error')),
			},
		);
		const result = await shared.reviewConventions('host', 'Discard oldest.');
		expect(result.accepted).toBe(false);
		expect(result.reason).not.toContain('sensitive');
	});

	it('limits repeated review submissions by actor and resets the allowance hourly', async () => {
		const review = vi.fn().mockResolvedValue({ accepted: true });
		const shared = new BotRuntime({ chooseAction: vi.fn() }, createBotPolicy(), {}, { review });
		for (let attempt = 0; attempt < 6; attempt += 1) {
			await expect(shared.reviewConventions('host', 'Discard oldest.')).resolves.toEqual({
				accepted: true,
			});
		}
		await expect(shared.reviewConventions('host', 'Discard oldest.')).resolves.toMatchObject({
			accepted: false,
		});
		expect(review).toHaveBeenCalledTimes(6);
		vi.setSystemTime(Date.now() + 3_600_000);
		await expect(shared.reviewConventions('host', 'Discard oldest.')).resolves.toEqual({
			accepted: true,
		});
	});

	it('bounds concurrent and stalled reviews', async () => {
		vi.useFakeTimers();
		const review = vi.fn().mockImplementation(() => new Promise(() => {}));
		const shared = new BotRuntime({ chooseAction: vi.fn() }, createBotPolicy(), {}, { review });
		const first = shared.reviewConventions('host-a', 'Discard oldest.');
		const second = shared.reviewConventions('host-b', 'Discard oldest.');
		await expect(shared.reviewConventions('host-c', 'Discard oldest.')).resolves.toMatchObject({
			accepted: false,
		});
		await vi.advanceTimersByTimeAsync(15_000);
		await expect(first).resolves.toMatchObject({ accepted: false });
		await expect(second).resolves.toMatchObject({ accepted: false });
		expect(review).toHaveBeenCalledTimes(2);
	});
});
