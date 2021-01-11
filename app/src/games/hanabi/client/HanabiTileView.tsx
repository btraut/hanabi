import { HanabiTile } from 'app/src/games/hanabi/HanabiGameData';
import classnames from 'classnames';

interface Props {
	tile: HanabiTile;
	hidden?: boolean;
}

const colorClasses = {
	red: 'text-red-500',
	blue: 'text-blue-500',
	green: 'text-green-500',
	yellow: 'text-yellow-500',
	white: 'text-white',
	purple: 'text-purple-500',
};

export default function HanabiTileView({ tile, hidden = false }: Props): JSX.Element {
	return (
		<div
			className={classnames([
				'bg-black rounded-lg text-3xl font-bold w-10 h-12 flex items-center justify-center select-none',
				colorClasses[tile.color],
			])}
		>
			{hidden ? '' : String(tile.number)}
		</div>
	);
}
