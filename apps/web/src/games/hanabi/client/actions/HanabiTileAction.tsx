import HanabiTileActionBody from '~/games/hanabi/client/actions/HanabiTileActionBody';
import { useHanabiHighlightContext } from '~/games/hanabi/client/HanabiHighlightContext';
import Eye from '~/games/hanabi/client/icons/Eye';
import EyeOff from '~/games/hanabi/client/icons/EyeOff';
import {
	HanabiGameActionDiscard,
	HanabiGameActionGiveClue,
	HanabiGameActionPlay,
	HanabiGameActionType,
} from '@hanabi/shared';
import useFocusVisible from '~/utils/client/useFocusVisible';
import classNames from 'classnames';
import { useState } from 'react';

interface Props {
	action: HanabiGameActionPlay | HanabiGameActionDiscard | HanabiGameActionGiveClue;
}

export default function HanabiTileAction({ action }: Props): JSX.Element {
	const [hovering, setHovering] = useState(false);
	const [focused, setFocused] = useState(false);

	const isFocusVisible = useFocusVisible();

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
			className={classNames(
				'text-md p-3 flex justify-between items-center w-full focus:outline-none',
				{
					'cursor-zoom-in': !thisActionHighlighted,
					'cursor-zoom-out': thisActionHighlighted,
				},
			)}
			onMouseEnter={() => {
				setHovering(true);
			}}
			onMouseLeave={() => {
				setHovering(false);
			}}
			onFocus={() => {
				setFocused(true);
			}}
			onBlur={() => {
				setFocused(false);
			}}
			onClick={handleClick}
		>
			<div>
				<HanabiTileActionBody action={action} />
			</div>
			{thisActionHighlighted && (
				<div className="mx-0.5">
					{hovering || (focused && isFocusVisible) ? (
						<EyeOff size={32} color={focused && isFocusVisible ? '#E11D48' : 'black'} />
					) : (
						<Eye size={32} color={focused && isFocusVisible ? '#E11D48' : 'black'} />
					)}
				</div>
			)}
		</button>
	);
}
