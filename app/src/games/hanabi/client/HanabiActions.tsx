import { useUserId } from 'app/src/components/SocketContext';
import HanabiAction from 'app/src/games/hanabi/client/HanabiAction';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import { useHanabiSoundsContext } from 'app/src/games/hanabi/client/HanabiSoundsContext';
import { HanabiGameActionType } from 'app/src/games/hanabi/HanabiGameData';
import useValueChanged from 'app/src/utils/client/useValueChanged';
import classnames from 'classnames';
import { useEffect } from 'react';

export default function HanabiActions(): JSX.Element {
	const userId = useUserId();
	const game = useHanabiGame();

	const hanabiSounds = useHanabiSoundsContext();

	const actionsReversed = [...game.gameData.actions].reverse();
	const newestAction = actionsReversed[0];

	const actionsChanged = useValueChanged(game.gameData.actions.length);
	useEffect(() => {
		if (!actionsChanged) {
			return;
		}

		if (!newestAction || newestAction.playerId === userId) {
			return;
		}

		if (newestAction.type === HanabiGameActionType.Play) {
			if (newestAction.valid) {
				hanabiSounds.playRight();
			} else {
				hanabiSounds.playWrong();
			}
		} else if (
			newestAction.type === HanabiGameActionType.Discard ||
			newestAction.type === HanabiGameActionType.GiveColorClue ||
			newestAction.type === HanabiGameActionType.GiveNumberClue
		) {
			hanabiSounds.playBeep();
		}
	}, [actionsChanged, hanabiSounds, newestAction, userId]);

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
