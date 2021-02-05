import HanabiAction from 'app/src/games/hanabi/client/HanabiAction';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import { HanabiShowActionsLimit } from 'app/src/games/hanabi/HanabiGameData';
import classnames from 'classnames';

interface Props {
	collapseHiddenActions?: boolean;
}

export default function HanabiActions({ collapseHiddenActions = false }: Props): JSX.Element {
	const game = useHanabiGame();

	const totalPlayers = Object.keys(game.gameData.players).length;
	const hideActions =
		game.gameData.finishedReason === null &&
		game.gameData.showActionsLimit === HanabiShowActionsLimit.ShowLast &&
		game.gameData.actions.length > totalPlayers;
	const hiddenActions = hideActions ? game.gameData.actions.length - totalPlayers : 0;
	const actionsLimited = game.gameData.actions.slice(hiddenActions);
	const actionsReversed = actionsLimited.reverse();

	return (
		<div>
			{actionsReversed.length === 0 && (
				<p className="italic text-md text-gray-700 p-4">No actions yet!</p>
			)}
			{actionsReversed.map((action, index) => {
				return (
					<div
						className={classnames('border-solid border-gray-600', {
							'border-t-2': index !== 0,
							'bg-gray-200': index % 2 === 1,
						})}
						key={action.id}
					>
						<HanabiAction action={action} />
					</div>
				);
			})}
			{hiddenActions && collapseHiddenActions ? (
				<div className="italic text-md text-gray-700 p-4 border-gray-600 border-t-2">
					{hiddenActions === 1
						? '1 previous action hidden'
						: `${hiddenActions} previous actions hidden`}
				</div>
			) : null}
		</div>
	);
}
