import type { BotDecisionProvider } from './OpenAiBot.js';
import type { BotPolicy } from './BotPolicy.js';

export interface BotLimits {
	timeoutMs: number;
	maxOutputTokens: number;
	resultTimeoutMs: number;
	resultMaxOutputTokens: number;
	maxConcurrent: number;
}

export const DEFAULT_BOT_LIMITS: BotLimits = {
	timeoutMs: 120_000,
	maxOutputTokens: 16_384,
	resultTimeoutMs: 5_000,
	resultMaxOutputTokens: 2_048,
	maxConcurrent: 3,
};

/** One runtime is shared by every game in the server process. */
export class BotRuntime {
	readonly limits: BotLimits;
	private active = 0;

	constructor(
		readonly provider: BotDecisionProvider,
		readonly policy: BotPolicy,
		limits: Partial<BotLimits> = {},
	) {
		this.limits = { ...DEFAULT_BOT_LIMITS, ...limits };
	}

	reserve(): 'busy' | { release: () => void } {
		if (this.active >= this.limits.maxConcurrent) return 'busy';
		this.active += 1;
		let released = false;
		return {
			release: () => {
				if (released) return;
				released = true;
				this.active -= 1;
			},
		};
	}
}
