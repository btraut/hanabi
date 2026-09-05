import { HanabiStage } from '@hanabi/shared';
import { useGameSelector } from './HanabiGameContext';

export default function HanabiBotError(): JSX.Element | null {
	const message = useGameSelector((game) => {
		const turn = game?.bots?.turn;
		if (
			game?.stage !== HanabiStage.Playing ||
			game.finishedReason !== null ||
			!turn ||
			turn.status === 'thinking' ||
			turn.opportunity === 'result'
		) {
			return null;
		}
		const name = game.players[turn.playerId]?.name ?? 'Bot';
		return `${name}: ${turn.message || 'Could not respond. Retrying automatically.'}`;
	});

	if (!message) return null;

	return (
		<p
			role="status"
			className="mb-4 rounded-md border border-hanabi-coral bg-hanabi-surface px-4 py-3 text-hanabi-text"
		>
			{message}
		</p>
	);
}
