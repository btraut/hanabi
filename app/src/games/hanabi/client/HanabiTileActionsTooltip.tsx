import Portal from 'app/src/components/Portal';
import Tooltip from 'app/src/components/Tooltip';
import { HanabiTile, tileBackgroundClasses } from 'app/src/games/hanabi/HanabiGameData';
import useFocusVisible from 'app/src/utils/client/useFocusVisible';
import classnames from 'classnames';
import { useEffect, useRef } from 'react';

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
	const isFocusVisible = useFocusVisible();

	const firstButtonRef = useRef<HTMLButtonElement | null>(null);

	useEffect(() => {
		if (firstButtonRef.current) {
			firstButtonRef.current.focus();
		}
	}, []);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				onClose();
			}
		};

		document.addEventListener('keydown', handleKeyDown);

		return () => {
			document.removeEventListener('keydown', handleKeyDown);
		};
	}, [onClose]);

	return (
		<Portal>
			<Tooltip onClose={onClose} top={coords.top} left={coords.left}>
				<div className="pb-0.5">
					<div className="bg-gray-900 rounded-lg py-2 px-3">
						{options === HanabiTileActionsTooltipOptions.Own && (
							<div className="grid grid-flow-col gap-x-3 items-center">
								<button
									className={classnames('font-bold text-xl text-white focus:outline-none', {
										'focus:text-red-600': isFocusVisible,
									})}
									onClick={() => {
										onAction('discard', tile);
									}}
									ref={firstButtonRef}
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
									className={classnames('font-bold text-xl text-white focus:outline-none', {
										'focus:text-red-600': isFocusVisible,
									})}
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
										'w-6 h-6 rounded-full border-black border-4 text-white focus:outline-none',
										{
											'focus:text-red-600': isFocusVisible,
										},
										tileBackgroundClasses[tile.color],
									)}
									onClick={() => {
										onAction('color', tile);
									}}
									ref={firstButtonRef}
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
									className={classnames('font-bold text-xl text-white focus:outline-none', {
										'focus:text-red-600': isFocusVisible,
									})}
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
