import { useUserId } from 'app/src/components/SocketContext';
import HanabiAction from 'app/src/games/hanabi/client/HanabiAction';
import { useHanabiAnimationManager } from 'app/src/games/hanabi/client/HanabiContext';
import { useHanabiOptionsContext } from 'app/src/games/hanabi/client/HanabiOptionsContext';
import useActionHighlighter from 'app/src/games/hanabi/client/useActionHighlighter';
import useActionSounds from 'app/src/games/hanabi/client/useActionSounds';
import {
	ActionsFilterOption,
	HanabiGameAction,
	HanabiGameActionType,
} from 'app/src/games/hanabi/HanabiGameData';
import classNames from 'classnames';

type Props = {
	readonly filter?: ActionsFilterOption;
};

function filterActions(
	actions: HanabiGameAction[],
	filter: ActionsFilterOption,
	userId: string,
): HanabiGameAction[] {
	if (filter === 'clues') {
		return actions.filter(
			(a) =>
				a.type === HanabiGameActionType.GiveColorClue ||
				a.type === HanabiGameActionType.GiveNumberClue,
		);
	}

	if (filter === 'to-me') {
		return actions.filter(
			(a) =>
				a.type === HanabiGameActionType.GiveColorClue ||
				(a.type === HanabiGameActionType.GiveNumberClue && a.recipientId === userId),
		);
	}

	if (filter === 'from-me') {
		return actions.filter(
			(a) =>
				a.type === HanabiGameActionType.GiveColorClue ||
				(a.type === HanabiGameActionType.GiveNumberClue && a.playerId === userId),
		);
	}

	if (filter === 'chat') {
		return actions.filter((a) => a.type === HanabiGameActionType.Chat);
	}

	return actions;
}

export default function HanabiActions({ filter = 'all' }: Props): JSX.Element {
	const animationManager = useHanabiAnimationManager();
	const { displayGameData: gameData } = animationManager;

	const userId = useUserId();

	const actions = gameData.actions.slice().reverse();
	const actionsFiltered = filterActions(actions, filter, userId);

	const { playSounds } = useHanabiOptionsContext();

	useActionHighlighter();
	useActionSounds(playSounds);

	return (
		<div>
			{actionsFiltered.map((action, index) => {
				return (
					<div
						className={classNames('border-solid border-gray-500', {
							'border-t-2': index !== 0,
							'bg-white': index % 2 === 0,
							'bg-gray-200': index % 2 === 1,
						})}
						key={action.id}
					>
						<HanabiAction action={action} />
					</div>
				);
			})}
			{actionsFiltered.length === 0 && (
				<div className="bg-white text-md p-3 italic">Nothing to show here.</div>
			)}
		</div>
	);
}
