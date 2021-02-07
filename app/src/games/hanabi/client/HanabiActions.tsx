import HanabiAction from 'app/src/games/hanabi/client/HanabiAction';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import useActionHighlighter from 'app/src/games/hanabi/client/useActionHighlighter';
import useActionSounds from 'app/src/games/hanabi/client/useActionSounds';
import classnames from 'classnames';

export default function HanabiActions(): JSX.Element {
	const game = useHanabiGame();

	const actionsReversed = game.gameData.actions.slice().reverse();

	useActionHighlighter();
	useActionSounds();

	return (
		<div>
			{actionsReversed.map((action, index) => {
				return (
					<div
						className={classnames('border-solid border-gray-600', {
							'border-t-2': index !== 0,
							'bg-white': index % 2 === 1,
							'bg-gray-200': index % 2 === 0,
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
