import { GameTranscriptV1 } from '@hanabi/shared';
import { useState } from 'react';
import HanabiReview from '../HanabiReview';
import transcript from './review-transcript.json';

// Development-only round recorded through real server gameplay.
export default function HanabiReviewFixtureView(): JSX.Element {
	const [open, setOpen] = useState(true);
	if (open)
		return (
			<HanabiReview
				transcript={transcript as GameTranscriptV1}
				userId={transcript.players[0].id}
				onExit={() => setOpen(false)}
				exitLabel="Back to preview"
			/>
		);
	return (
		<main className="hanabi-game-surface min-h-screen p-8 text-hanabi-text">
			<h1 className="mb-4 text-3xl">Game review preview</h1>
			<p className="mb-5">
				Alice, Ben, and Chika · {transcript.moves.length} turns · Sample completed round
			</p>
			<button type="button" className="hanabi-review-entry" onClick={() => setOpen(true)}>
				Review game
			</button>
		</main>
	);
}
