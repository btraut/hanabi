import { useSocket } from 'app/src/components/SocketContext';
import HanabiAction from 'app/src/games/hanabi/client/HanabiAction';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import classnames from 'classnames';

export default function HanabiActions(): JSX.Element {
	const { userId } = useSocket();
	const game = useHanabiGame();

	if (!game || !userId) {
		throw new Error('Must connect/join. This should never happen.');
	}

	const actionsReversed = [...game.gameData.actions].reverse();

	return (
		<div>
			{actionsReversed.length === 0 && (
				<p className="italic text-lg color-gray-600 p-4">No actions yet!</p>
			)}
			{actionsReversed.map((action, index) => {
				return (
					<div
						className={classnames('border-solid border-gray-600 cursor-zoom-in', {
							'border-t-2': index !== 0,
						})}
						key={action.id}
					>
						<HanabiAction action={action} />
					</div>
				);
			})}
		</div>
	);
}
