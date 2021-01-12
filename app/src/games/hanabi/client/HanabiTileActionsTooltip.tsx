import Portal from 'app/src/components/Portal';
import { HanabiTile, tileBackgroundClasses } from 'app/src/games/hanabi/HanabiGameData';
import classnames from 'classnames';

interface Props {
	tile: HanabiTile;
	coords: { left: number; top: number };
	ownTile?: boolean;
}

export default function HanabiTileActionsTooltip({ tile, ownTile, coords }: Props): JSX.Element {
	return (
		<Portal>
			<div
				data-tooltip
				style={coords}
				className="absolute transform -translate-y-full -translate-x-1/2 pb-0.5"
			>
				<div className="bg-gray-900 rounded-lg py-2 px-3 text-white">
					{ownTile ? (
						<div className="grid grid-flow-col gap-x-3 items-center">
							<div className="font-bold text-xl">Discard</div>
							<div
								className="border-solid h-6"
								style={{
									borderRightWidth: 1,
									borderRightColor: '#ccc',
									borderLeftWidth: 1,
									borderLeftColor: '#777',
								}}
							/>
							<div className="font-bold text-xl">Play</div>
						</div>
					) : (
						<div className="grid grid-flow-col gap-x-3 items-center">
							<div
								className={classnames(
									'w-6 h-6 rounded-full border-solid border-black border-4',
									tileBackgroundClasses[tile.color],
								)}
							/>
							<div
								className="border-solid h-6"
								style={{
									borderRightWidth: 1,
									borderRightColor: '#ccc',
									borderLeftWidth: 1,
									borderLeftColor: '#777',
								}}
							/>
							<div className="font-bold text-xl">{tile.number}</div>
						</div>
					)}
				</div>
				<div className="flex justify-center">
					<div
						style={{
							borderLeftColor: 'transparent',
							borderRightColor: 'transparent',
							borderTopWidth: 12,
							borderLeftWidth: 12,
							borderRightWidth: 12,
						}}
						className="border-gray-900 border-solid"
					/>
				</div>
			</div>
		</Portal>
	);
}
