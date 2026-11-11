import type { GameTranscriptV1 } from './GameTranscript.js';

export interface BenchReviewLog {
	playerId: string;
	/** Turn decisions precede turn + 1; result reflections follow turn. */
	turn: number;
	opportunity: 'turn' | 'result' | 'debrief' | 'discussion';
	text: string;
}

export interface BenchReviewGameSummary {
	id: string;
	label: string;
	status: 'waiting' | 'playing' | 'completed' | 'failed';
	score: number | null;
	maxScore: number | null;
}

/** Privileged local review data, never included in player prompts or public game APIs. */
export interface BenchReviewSnapshot {
	source: string;
	games: BenchReviewGameSummary[];
	selectedGameId: string | null;
	game:
		| (BenchReviewGameSummary & {
				transcript: GameTranscriptV1;
				logs: BenchReviewLog[];
				conventions: string;
				error: string | null;
				dreamer: { changed: boolean; conventions: string | null; explanation: string } | null;
		  })
		| null;
}
