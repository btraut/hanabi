import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBotPolicy } from './BotPolicy.js';
import { BotRuntime } from './BotRuntime.js';
import type { BotDecisionProvider } from './OpenAiBot.js';

function runtime(limits: ConstructorParameters<typeof BotRuntime>[2] = {}) {
	const provider: BotDecisionProvider = { chooseAction: vi.fn() };
	return new BotRuntime(provider, createBotPolicy('test-model', ''), {
		maxConcurrent: 2,
		globalMaxAttempts: 10,
		globalMaxTokens: 100,
		globalWindowMs: 1_000,
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

	it('shares concurrency across callers and makes release idempotent', () => {
		const shared = runtime();
		const first = reserved(shared.reserve(10));
		const second = reserved(shared.reserve(10));
		expect(shared.reserve(10)).toBe('busy');
		first.release(10);
		first.release(0);
		const third = reserved(shared.reserve(10));
		expect(shared.reserve(10)).toBe('busy');
		second.release(10);
		third.release(10);
		expect(typeof shared.reserve(10)).toBe('object');
	});

	it('counts released requests against the window attempt budget', () => {
		const shared = runtime({ globalMaxAttempts: 2 });
		reserved(shared.reserve(1)).release(0);
		reserved(shared.reserve(1)).release(0);
		expect(shared.reserve(1)).toBe('global_budget');
	});

	it('reserves worst-case tokens then reconciles known usage', () => {
		const shared = runtime();
		const first = reserved(shared.reserve(80));
		expect(shared.reserve(21)).toBe('global_budget');
		first.release(20);
		const second = reserved(shared.reserve(80));
		expect(shared.reserve(1)).toBe('global_budget');
		second.release(30);
		expect(typeof shared.reserve(50)).toBe('object');
	});

	it('retains the full reservation when cancellation or errors leave usage unknown', () => {
		const shared = runtime();
		reserved(shared.reserve(80)).release();
		expect(shared.reserve(21)).toBe('global_budget');
		expect(typeof shared.reserve(20)).toBe('object');
	});

	it('opens a fresh window while outstanding requests keep their concurrency slots', () => {
		const shared = runtime({ maxConcurrent: 1, globalMaxAttempts: 1 });
		const old = reserved(shared.reserve(100));
		vi.setSystemTime(Date.now() + 1_000);
		expect(shared.reserve(100)).toBe('busy');
		old.release(0);
		const current = reserved(shared.reserve(100));
		current.release(100);
		expect(shared.reserve(1)).toBe('global_budget');
	});

	it('does not credit old-window usage into the fresh token allowance', () => {
		const shared = runtime({ maxConcurrent: 3 });
		const old = reserved(shared.reserve(90));
		vi.setSystemTime(Date.now() + 1_000);
		const current = reserved(shared.reserve(80));
		old.release(0);
		expect(shared.reserve(21)).toBe('global_budget');
		current.release(80);
	});

	it('expires reservations individually across a rolling interval', () => {
		const shared = runtime({ globalMaxAttempts: 2 });
		reserved(shared.reserve(10)).release(10);
		vi.setSystemTime(Date.now() + 500);
		reserved(shared.reserve(10)).release(10);
		vi.setSystemTime(Date.now() + 500);
		expect(shared.availability(10)).toBeNull();
		reserved(shared.reserve(10)).release(10);
		expect(shared.reserve(10)).toBe('global_budget');
		expect(shared.nextAvailabilityCheckMs()).toBe(500);
		vi.setSystemTime(Date.now() + 500);
		expect(shared.availability(10)).toBeNull();
	});
});
