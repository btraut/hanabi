import { useUserId } from '~/components/SocketContext';
import HanabiActivityEvent from './HanabiActivityEvent';
import { useGameData } from './HanabiGameContext';
import { getAppendedActions } from './useLatestActions';
import {
	HanabiGameAction,
	HanabiGameActionType,
	HanabiGameData,
	HanabiStage,
} from '@hanabi/shared';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type ToastGameData = Pick<HanabiGameData, 'actions' | 'players' | 'turnOrder' | 'seed' | 'stage'>;
interface ActionToast {
	action: HanabiGameAction;
	gameData: ToastGameData;
}

const MOVE_TYPES = new Set([
	HanabiGameActionType.Play,
	HanabiGameActionType.Discard,
	HanabiGameActionType.GiveColorClue,
	HanabiGameActionType.GiveNumberClue,
]);
export const HANABI_ACTION_TOAST_DURATION_MS = 4000;

export function HanabiLiveActionToasts(): JSX.Element {
	return <HanabiActionToasts gameData={useGameData()} userId={useUserId()} />;
}

export default function HanabiActionToasts({
	gameData,
	userId,
}: {
	gameData: ToastGameData;
	userId: string;
}): JSX.Element {
	const [state, setState] = useState(() => ({
		actions: gameData.actions,
		seed: gameData.seed,
		stage: gameData.stage,
		queue: [] as ActionToast[],
	}));
	if (
		state.actions !== gameData.actions ||
		state.seed !== gameData.seed ||
		state.stage !== gameData.stage
	) {
		const previousId = state.actions.at(-1)?.id;
		const reset =
			state.seed !== gameData.seed ||
			gameData.stage === HanabiStage.Setup ||
			(previousId !== undefined && !gameData.actions.some(({ id }) => id === previousId));
		const appended = reset ? [] : getAppendedActions(state.actions, gameData.actions);
		setState({
			actions: gameData.actions,
			seed: gameData.seed,
			stage: gameData.stage,
			queue: reset
				? []
				: [
						...state.queue,
						...appended
							.filter((action) => MOVE_TYPES.has(action.type))
							.map((action) => ({
								action,
								gameData,
							})),
					],
		});
	}

	const active = state.queue[0];
	const activeId = active?.action.id;
	useEffect(() => {
		if (!activeId) return;
		const timer = window.setTimeout(() => {
			setState((current) => ({ ...current, queue: current.queue.slice(1) }));
		}, HANABI_ACTION_TOAST_DURATION_MS);
		return () => window.clearTimeout(timer);
	}, [activeId]);

	return createPortal(
		<div className="hanabi-action-toasts">
			<div role="status" aria-live="polite" aria-atomic="true">
				{active && (
					<div
						className="hanabi-action-toast"
						key={activeId}
						style={{ animationDuration: `${HANABI_ACTION_TOAST_DURATION_MS}ms` }}
					>
						<HanabiActivityEvent
							action={active.action}
							gameData={active.gameData}
							userId={userId}
						/>
						<button
							type="button"
							className="hanabi-action-toast-dismiss"
							aria-label="Dismiss action notification"
							onClick={() => setState((current) => ({ ...current, queue: current.queue.slice(1) }))}
						>
							<span aria-hidden="true">×</span>
						</button>
					</div>
				)}
			</div>
		</div>,
		document.body,
	);
}
