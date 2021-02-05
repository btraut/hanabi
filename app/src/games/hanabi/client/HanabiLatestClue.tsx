import { useUserId } from 'app/src/components/SocketContext';
import { useHanabiHighlightContext } from 'app/src/games/hanabi/client/HanabiHighlightContext';
import HanabiTileActionBody from 'app/src/games/hanabi/client/HanabiTileActionBody';
import X from 'app/src/games/hanabi/client/icons/X';
import useLatestActions from 'app/src/games/hanabi/client/useLatestActions';
import {
	HanabiGameActionDiscard,
	HanabiGameActionGiveClue,
	HanabiGameActionPlay,
	HanabiGameActionType,
} from 'app/src/games/hanabi/HanabiGameData';
import { useEffect, useState } from 'react';

export default function HanabiLatestClue(): JSX.Element | null {
	const userId = useUserId();
	const { highlightAction, highlightTiles } = useHanabiHighlightContext();

	const [latestDisplayAction, setLatestDisplayAction] = useState<string | null>(null);
	const [showAction, setShowAction] = useState(false);

	const latestActions = useLatestActions();
	const latestTileAction:
		| HanabiGameActionPlay
		| HanabiGameActionDiscard
		| HanabiGameActionGiveClue = latestActions
		.reverse()
		.find((a) =>
			[
				HanabiGameActionType.Play,
				HanabiGameActionType.Discard,
				HanabiGameActionType.GiveColorClue,
				HanabiGameActionType.GiveNumberClue,
			].includes(a.type),
		) as any;
	const latestTileActionId = latestTileAction ? latestTileAction.id : null;
	const latestTileActionIsMine = latestTileAction?.playerId === userId;

	useEffect(() => {
		if (latestTileActionId !== latestDisplayAction) {
			setLatestDisplayAction(latestTileActionId);

			if (!latestTileActionIsMine) {
				setShowAction(true);
			}
		}
	}, [latestDisplayAction, latestTileActionId, latestTileActionIsMine]);

	const handleClose = () => {
		setShowAction(false);
		highlightAction(null);
		highlightTiles(new Set());
	};

	if (!showAction) {
		return null;
	}

	return (
		<div className="border-4 border-black bg-blue-100 rounded-xl px-4 flex justify-between items-center text-md xl:text-lg mb-6">
			<span>
				<HanabiTileActionBody action={latestTileAction} />
			</span>
			<button onClick={handleClose} className="p-4 -mx-4">
				<X size={20} />
			</button>
		</div>
	);
}
