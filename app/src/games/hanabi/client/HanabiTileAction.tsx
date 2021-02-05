import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import { useHanabiHighlightContext } from 'app/src/games/hanabi/client/HanabiHighlightContext';
import HanabiTileActionBody from 'app/src/games/hanabi/client/HanabiTileActionBody';
import HanabiTileView, { TileViewSize } from 'app/src/games/hanabi/client/HanabiTileView';
import Eye from 'app/src/games/hanabi/client/icons/Eye';
import EyeOff from 'app/src/games/hanabi/client/icons/EyeOff';
import {
	HanabiGameActionDiscard,
	HanabiGameActionGiveClue,
	HanabiGameActionPlay,
	HanabiGameActionType,
	tileBackgroundClasses,
} from 'app/src/games/hanabi/HanabiGameData';
import classnames from 'classnames';
import { useState } from 'react';

interface Props {
	action: HanabiGameActionPlay | HanabiGameActionDiscard | HanabiGameActionGiveClue;
}

const ENGLISH_NUMBERS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];

export default function HanabiTileAction({ action }: Props): JSX.Element {
	const game = useHanabiGame();

	const [hovering, setHovering] = useState(false);

	const { highlightTiles, highlightAction, highlightedAction } = useHanabiHighlightContext();
	const thisActionHighlighted = highlightedAction === action.id;

	const handleClick = () => {
		if (thisActionHighlighted) {
			highlightAction(null);
			highlightTiles(new Set());
		} else {
			highlightAction(action.id);

			if (
				action.type === HanabiGameActionType.Play ||
				action.type === HanabiGameActionType.Discard
			) {
				highlightTiles(new Set([action.tile.id]));
			} else if (
				action.type === HanabiGameActionType.GiveColorClue ||
				action.type === HanabiGameActionType.GiveNumberClue
			) {
				highlightTiles(new Set(action.tiles.map((a) => a.id)));
			}
		}
	};

	return (
		<button
			className={classnames('text-md xl:text-lg p-4 flex justify-between items-center w-full', {
				'cursor-zoom-in': !thisActionHighlighted,
				'cursor-zoom-out': thisActionHighlighted,
			})}
			onMouseEnter={() => {
				setHovering(true);
			}}
			onMouseLeave={() => {
				setHovering(false);
			}}
			onClick={handleClick}
		>
			<div>
				<HanabiTileActionBody action={action} />
			</div>
			{(hovering || thisActionHighlighted) && (
				<div className="mx-0.5">
					{thisActionHighlighted ? <EyeOff size={32} /> : <Eye size={32} />}
				</div>
			)}
		</button>
	);
}
