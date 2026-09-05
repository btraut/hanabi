import type { BotDecisionProvider } from './OpenAiBot.js';
import type { BotPolicy } from './BotPolicy.js';

export interface BotLimits {
	timeoutMs: number;
	maxOutputTokens: number;
	maxConcurrent: number;
	roundMaxAttempts: number;
	roundMaxTokens: number;
	globalWindowMs: number;
	globalMaxAttempts: number;
	globalMaxTokens: number;
}

export const DEFAULT_BOT_LIMITS: BotLimits = {
	timeoutMs: 120_000,
	maxOutputTokens: 16_384,
	maxConcurrent: 3,
	roundMaxAttempts: 200,
	roundMaxTokens: 2_000_000,
	globalWindowMs: 3_600_000,
	globalMaxAttempts: 500,
	globalMaxTokens: 5_000_000,
};

/** One runtime is shared by every game in the server process. */
export class BotRuntime {
	readonly limits: BotLimits;
	private active = 0;
	private reservations: Array<{ createdAt: number; tokens: number }> = [];

	constructor(
		readonly provider: BotDecisionProvider,
		readonly policy: BotPolicy,
		limits: Partial<BotLimits> = {},
	) {
		this.limits = { ...DEFAULT_BOT_LIMITS, ...limits };
	}

	availability(tokens: number): 'busy' | 'global_budget' | null {
		const now = Date.now();
		this.reservations = this.reservations.filter(
			({ createdAt }) => now - createdAt < this.limits.globalWindowMs,
		);
		if (this.active >= this.limits.maxConcurrent) return 'busy';
		if (
			this.reservations.length >= this.limits.globalMaxAttempts ||
			this.reservations.reduce((total, entry) => total + entry.tokens, 0) + tokens >
				this.limits.globalMaxTokens
		)
			return 'global_budget';
		return null;
	}

	nextAvailabilityCheckMs(): number {
		return Math.max(
			1,
			(this.reservations[0]?.createdAt ?? Date.now()) + this.limits.globalWindowMs - Date.now(),
		);
	}

	reserve(tokens: number): 'busy' | 'global_budget' | { release: (usedTokens?: number) => void } {
		const blocked = this.availability(tokens);
		if (blocked) return blocked;
		this.active += 1;
		const reservation = { createdAt: Date.now(), tokens };
		this.reservations.push(reservation);
		let released = false;
		return {
			release: (usedTokens) => {
				if (released) return;
				released = true;
				this.active -= 1;
				if (usedTokens !== undefined) reservation.tokens = usedTokens;
			},
		};
	}
}
