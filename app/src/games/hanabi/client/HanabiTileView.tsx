import {
	HanabiTileColor,
	HanabiTileNumber,
	tileColorClasses,
} from 'app/src/games/hanabi/HanabiGameData';
import classnames from 'classnames';

interface Props {
	color: HanabiTileColor;
	number: HanabiTileNumber;
	hidden?: boolean;
	draggable?: boolean;
}

export default function HanabiTileView({
	color,
	number,
	hidden = false,
	draggable = false,
}: Props): JSX.Element {
	return (
		<div
			className={classnames([
				'bg-black rounded-lg text-3xl font-bold w-10 h-12 flex items-center justify-center select-none',
				tileColorClasses[color],
				{
					'cursor-default': !draggable,
					'cursor-move': draggable,
				},
			])}
		>
			{hidden ? '' : String(number)}
		</div>
	);
}
