import type { BotDecisionProvider } from './OpenAiBot.js';
import type { BotPolicy } from './BotPolicy.js';
import {
	CONVENTIONS_REVIEW_TIMEOUT_MS,
	CONVENTIONS_REVIEW_UNAVAILABLE,
	conventionsInputError,
	type BotConventionsReview,
	type BotConventionsReviewer,
} from './BotConventionsReview.js';

export interface BotLimits {
	timeoutMs: number;
	maxOutputTokens: number;
	resultTimeoutMs: number;
	resultMaxOutputTokens: number;
	maxConcurrent: number;
	customRoundMaxAttempts: number;
	customRoundMaxTokens: number;
	customGlobalMaxAttempts: number;
	customGlobalMaxTokens: number;
}

export const DEFAULT_BOT_LIMITS: BotLimits = {
	timeoutMs: 120_000,
	maxOutputTokens: 16_384,
	resultTimeoutMs: 5_000,
	resultMaxOutputTokens: 2_048,
	maxConcurrent: 3,
	customRoundMaxAttempts: 256,
	customRoundMaxTokens: 10_000_000,
	customGlobalMaxAttempts: 1_000,
	customGlobalMaxTokens: 50_000_000,
};

const WINDOW_MS = 60 * 60 * 1_000;
type Usage = { attempts: number; tokens: number };

/** One runtime is shared by every game in the server process. */
export class BotRuntime {
	readonly limits: BotLimits;
	private active = 0;
	private customWindowStart = Date.now();
	private customGlobal: Usage = { attempts: 0, tokens: 0 };
	private customRounds = new Map<string, Usage>();
	private reviewWindowStart = Date.now();
	private reviewActors = new Map<string, number>();
	private reviewAttempts = 0;
	private activeReviews = 0;

	constructor(
		readonly provider: BotDecisionProvider,
		readonly policy: BotPolicy,
		limits: Partial<BotLimits> = {},
		private readonly reviewer?: BotConventionsReviewer,
	) {
		this.limits = { ...DEFAULT_BOT_LIMITS, ...limits };
	}

	async reviewConventions(actorId: string, text: string): Promise<BotConventionsReview> {
		const error = conventionsInputError(text);
		if (error) return { accepted: false, reason: error };
		if (!this.reviewer) return { accepted: false, reason: CONVENTIONS_REVIEW_UNAVAILABLE };
		if (Date.now() - this.reviewWindowStart >= WINDOW_MS) {
			this.reviewWindowStart = Date.now();
			this.reviewActors.clear();
			this.reviewAttempts = 0;
		}
		const actorAttempts = this.reviewActors.get(actorId) ?? 0;
		if (actorAttempts >= 6 || this.reviewAttempts >= 60 || this.activeReviews >= 2) {
			return {
				accepted: false,
				reason:
					'Too many instruction checks. Try again later, or reset to the default instructions.',
			};
		}
		this.reviewActors.set(actorId, actorAttempts + 1);
		this.reviewAttempts += 1;
		this.activeReviews += 1;
		let timeout: ReturnType<typeof setTimeout> | undefined;
		try {
			return await Promise.race([
				this.reviewer.review(text),
				new Promise<BotConventionsReview>((resolve) => {
					timeout = setTimeout(
						() => resolve({ accepted: false, reason: CONVENTIONS_REVIEW_UNAVAILABLE }),
						CONVENTIONS_REVIEW_TIMEOUT_MS,
					);
					timeout.unref();
				}),
			]);
		} catch {
			return { accepted: false, reason: CONVENTIONS_REVIEW_UNAVAILABLE };
		} finally {
			if (timeout) clearTimeout(timeout);
			this.activeReviews -= 1;
		}
	}

	/** Seed from the persisted main round before starting independently counted result work. */
	seedCustomRound(key: string, attempts: number, tokens: number): void {
		const usage = this.customRounds.get(key);
		if (usage) {
			usage.attempts = Math.max(usage.attempts, attempts);
			usage.tokens = Math.max(usage.tokens, tokens);
		} else {
			// Snapshots supply the durable baseline when an inactive entry is revisited.
			if (this.customRounds.size >= 2_000) {
				const oldest = this.customRounds.keys().next().value;
				if (oldest !== undefined) this.customRounds.delete(oldest);
			}
			this.customRounds.set(key, { attempts, tokens });
		}
	}

	/** Conservative admission reservations are not refunded after a failed or cancelled request. */
	reserveCustom(key: string, estimatedTokens: number, persisted: Usage) {
		this.seedCustomRound(key, persisted.attempts, persisted.tokens);
		const round = this.customRounds.get(key)!;
		if (
			!Number.isSafeInteger(estimatedTokens) ||
			estimatedTokens < 0 ||
			round.attempts >= this.limits.customRoundMaxAttempts ||
			round.tokens + estimatedTokens > this.limits.customRoundMaxTokens
		) {
			return 'round_budget' as const;
		}
		if (Date.now() - this.customWindowStart >= WINDOW_MS) {
			this.customWindowStart = Date.now();
			this.customGlobal = { attempts: 0, tokens: 0 };
		}
		if (
			this.customGlobal.attempts >= this.limits.customGlobalMaxAttempts ||
			this.customGlobal.tokens + estimatedTokens > this.limits.customGlobalMaxTokens
		) {
			return 'global_budget' as const;
		}
		const reservation = this.reserve();
		if (reservation === 'busy') return reservation;
		round.attempts += 1;
		round.tokens += estimatedTokens;
		this.customGlobal.attempts += 1;
		this.customGlobal.tokens += estimatedTokens;
		return reservation;
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
