import Portal from '~/components/Portal';
import Tooltip from '~/components/Tooltip';
import { useBoardData } from '~/games/hanabi/client/HanabiGameContext';
import {
	HanabiClueColor,
	HanabiTile,
	canHanabiPlayerDiscard,
	isHanabiRainbowRuleSet,
	tileBackgroundClasses,
} from '@hanabi/shared';
import classNames from 'classnames';
import { useEffect, useRef } from 'react';

export enum HanabiTileActionsTooltipType {
	Own = 'Own',
	OtherPlayer = 'OtherPlayer',
	NoClues = 'NoClues',
}

interface Props {
	tileId: string;
	coords: { left: number; top: number };
	type: HanabiTileActionsTooltipType;
	onAction: (
		action: 'discard' | 'play' | 'color' | 'number',
		tile: HanabiTile,
		details?: { color?: HanabiClueColor },
	) => void;
	onClose: () => void;
}

const colorClueButtonClassName =
	'size-11 rounded-full border border-white/15 shadow-[0_2px_7px_rgb(0_0_0_/_38%)] transition-[border-color,filter,box-shadow] focus:outline-none hocus:border-hanabi-text-muted/80 hocus:brightness-110';

export default function HanabiTileActionsTooltip({
	tileId,
	type,
	coords,
	onAction,
	onClose,
}: Props): JSX.Element {
	const gameData = useBoardData();

	const tile = gameData.tiles[tileId];
	const isBlackTile = tile.color === 'black';
	const canDiscard = canHanabiPlayerDiscard(gameData.clues);

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

	const showMultipleColorOptions =
		tile.color === 'rainbow' && isHanabiRainbowRuleSet(gameData.ruleSet);
	const rainbowButtonColors: HanabiClueColor[] = ['red', 'blue', 'green', 'yellow', 'white'];
	if (gameData.ruleSet === '6-color') {
		rainbowButtonColors.push('purple');
	}

	return (
		<Portal>
			<Tooltip onClose={onClose} top={coords.top - 18} left={coords.left}>
				<div className="rounded-lg border border-hanabi-border bg-hanabi-table-deep px-2 py-1.5 shadow-[0_12px_28px_rgb(0_0_0_/_45%)]">
					{type === HanabiTileActionsTooltipType.Own && (
						<div className="flex items-center gap-1">
							<button
								className="hanabi-focus-ring min-h-11 rounded-md px-3 text-base font-semibold text-white focus:outline-none hocus:bg-hanabi-coral/15 hocus:text-hanabi-coral-soft disabled:cursor-not-allowed disabled:text-hanabi-text-muted"
								onClick={() => {
									if (canDiscard) onAction('discard', tile);
								}}
								disabled={!canDiscard}
								ref={canDiscard ? firstButtonRef : undefined}
								title={canDiscard ? undefined : 'All 8 clues are already available.'}
							>
								Discard
							</button>
							<div
								className="h-7 border-solid"
								style={{
									borderRightWidth: 1,
									borderRightColor: '#ccc',
									borderLeftWidth: 1,
									borderLeftColor: '#777',
								}}
							/>
							<button
								className="hanabi-focus-ring min-h-11 rounded-md px-3 text-base font-semibold text-white focus:outline-none hocus:bg-hanabi-coral/15 hocus:text-hanabi-coral-soft"
								onClick={() => {
									onAction('play', tile);
								}}
								ref={canDiscard ? undefined : firstButtonRef}
							>
								Play
							</button>
						</div>
					)}
					{type === HanabiTileActionsTooltipType.OtherPlayer && (
						<div className="flex flex-wrap items-center justify-center gap-2">
							{!isBlackTile && (
								<>
									{showMultipleColorOptions ? (
										<div>
											{rainbowButtonColors.map((buttonColor) => (
												<button
													aria-label={`Give ${buttonColor} clue`}
													key={buttonColor}
													className={classNames(
														colorClueButtonClassName,
														tileBackgroundClasses[buttonColor],
													)}
													onClick={() => {
														onAction('color', tile, { color: buttonColor });
													}}
													ref={firstButtonRef}
												/>
											))}
										</div>
									) : (
										<button
											aria-label={`Give ${tile.color} clue`}
											className={classNames(
												colorClueButtonClassName,
												tileBackgroundClasses[tile.color],
											)}
											onClick={() => {
												onAction('color', tile);
											}}
											ref={firstButtonRef}
										/>
									)}
									<div
										className="h-7 border-solid"
										style={{
											borderRightWidth: 1,
											borderRightColor: '#ccc',
											borderLeftWidth: 1,
											borderLeftColor: '#777',
										}}
									/>
								</>
							)}
							<button
								aria-label={`Give number ${tile.number} clue`}
								className="min-h-11 min-w-11 rounded-md px-3 text-2xl font-bold leading-none text-white transition-colors focus:outline-none hocus:bg-hanabi-coral/15 hocus:text-hanabi-coral-soft"
								onClick={() => {
									onAction('number', tile);
								}}
								ref={isBlackTile ? firstButtonRef : undefined}
							>
								{tile.number}
							</button>
						</div>
					)}
					{type === HanabiTileActionsTooltipType.NoClues && (
						<div className="min-h-11 select-none px-3 py-2.5 text-white">No clues left!</div>
					)}
				</div>
			</Tooltip>
		</Portal>
	);
}
