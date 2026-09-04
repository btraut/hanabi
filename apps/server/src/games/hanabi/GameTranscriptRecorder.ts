import { GameTranscriptSnapshot } from './GameTranscript.js';

export interface GameTranscriptRecorder {
	record(snapshot: GameTranscriptSnapshot): void;
	close(): Promise<void>;
}

export const NOOP_GAME_TRANSCRIPT_RECORDER: GameTranscriptRecorder = Object.freeze({
	record: () => undefined,
	close: () => Promise.resolve(),
});
