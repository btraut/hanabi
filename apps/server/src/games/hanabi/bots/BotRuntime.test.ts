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

function reserved(value: ReturnType<BotRuntime['reserve']>) {
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
});
