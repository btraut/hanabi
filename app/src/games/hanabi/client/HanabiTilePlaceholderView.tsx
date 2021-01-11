import {
	HanabiTileColor,
	HanabiTileNumber,
	tileColorClasses,
} from 'app/src/games/hanabi/HanabiGameData';
import classnames from 'classnames';

interface Props {
	color: HanabiTileColor;
	number?: HanabiTileNumber;
}

export default function HanabiTilePlaceholderView({ color, number }: Props): JSX.Element {
	return (
		<div
			className={classnames([
				'bg-black rounded-lg text-3xl font-bold w-10 h-12 flex items-center justify-center select-none opacity-20 cursor-default',
				tileColorClasses[color],
			])}
		>
			{typeof number === 'number' && String(number)}
		</div>
	);
}
