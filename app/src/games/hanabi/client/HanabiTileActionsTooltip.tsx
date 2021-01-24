import Portal from 'app/src/components/Portal';
import Tooltip from 'app/src/components/Tooltip';
import { HanabiTile, tileBackgroundClasses } from 'app/src/games/hanabi/HanabiGameData';
import classnames from 'classnames';

export enum HanabiTileActionsTooltipOptions {
	Own = 'Own',
	OtherPlayer = 'OtherPlayer',
}

interface Props {
	tile: HanabiTile;
	coords: { left: number; top: number };
	options: HanabiTileActionsTooltipOptions;
	onAction: (action: 'discard' | 'play' | 'color' | 'number', tile: HanabiTile) => void;
	onClose: () => void;
}

export default function HanabiTileActionsTooltip({
	tile,
	options,
	coords,
	onAction,
	onClose,
}: Props): JSX.Element {
	return (
		<Portal>
			<Tooltip onClose={onClose} top={coords.top} left={coords.left}>
				<div className="pb-0.5">
					<div className="bg-gray-900 rounded-lg py-2 px-3 text-white">
						{options === HanabiTileActionsTooltipOptions.Own && (
							<div className="grid grid-flow-col gap-x-3 items-center">
								<button
									className="font-bold text-xl"
									onClick={() => {
										onAction('discard', tile);
									}}
								>
									Discard
								</button>
								<div
									className="border-solid h-6"
									style={{
										borderRightWidth: 1,
										borderRightColor: '#ccc',
										borderLeftWidth: 1,
										borderLeftColor: '#777',
									}}
								/>
								<button
									className="font-bold text-xl"
									onClick={() => {
										onAction('play', tile);
									}}
								>
									Play
								</button>
							</div>
						)}
						{options === HanabiTileActionsTooltipOptions.OtherPlayer && (
							<div className="grid grid-flow-col gap-x-3 items-center">
								<button
									className={classnames(
										'w-6 h-6 rounded-full border-black border-4',
										tileBackgroundClasses[tile.color],
									)}
									onClick={() => {
										onAction('color', tile);
									}}
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
								<button
									className="font-bold text-xl"
									onClick={() => {
										onAction('number', tile);
									}}
								>
									{tile.number}
								</button>
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
							className="border-gray-900"
						/>
					</div>
				</div>
			</Tooltip>
		</Portal>
	);
}
