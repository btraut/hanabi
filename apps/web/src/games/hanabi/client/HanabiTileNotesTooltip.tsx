import Portal from '~/components/Portal';
import Tooltip from '~/components/Tooltip';
import { useBoardData } from '~/games/hanabi/client/HanabiGameContext';
import {
	HanabiClueColor,
	HanabiTileNotes,
	HanabiTileNumber,
	tileBackgroundClasses,
} from '@hanabi/shared';
import classNames from 'classnames';

export enum HanabiTileActionsTooltipType {
	Own = 'Own',
	OtherPlayer = 'OtherPlayer',
	NoClues = 'NoClues',
}

interface Props {
	notes: HanabiTileNotes | undefined;
	coords: { left: number; top: number };
	onClose: () => void;
}

export function getHanabiTileNotesDescription(notes: HanabiTileNotes | undefined): string {
	if (!notes || (notes.colors.length === 0 && notes.numbers.length === 0)) {
		return 'No clues recorded for this card.';
	}

	const descriptions: string[] = [];
	if (notes.colors.length > 0) descriptions.push(`Color clues: ${notes.colors.join(', ')}.`);
	if (notes.numbers.length > 0) descriptions.push(`Number clues: ${notes.numbers.join(', ')}.`);
	return descriptions.join(' ');
}

export default function HanabiTileNotesTooltip({ notes, coords, onClose }: Props): JSX.Element {
	const gameData = useBoardData();

	const allColors: HanabiClueColor[] = ['red', 'blue', 'green', 'yellow', 'white'];
	if (gameData.ruleSet === '6-color') {
		allColors.push('purple');
	}

	const allNumbers: HanabiTileNumber[] = [1, 2, 3, 4, 5];

	return (
		<Portal>
			<Tooltip top={coords.top} left={coords.left} position="below" fadeIn onClose={onClose}>
				<div className="mt-1" role="tooltip" aria-live="polite">
					<span className="sr-only">{getHanabiTileNotesDescription(notes)}</span>
					<div className="bg-gray-900 rounded-lg pb-2 pt-1 px-2">
						<div aria-hidden="true" className="grid grid-flow-col gap-1.5 justify-center">
							{allNumbers.map((number) => (
								<div
									key={number}
									className={classNames('font-bold text-l text-white', {
										'opacity-30': !notes?.numbers.includes(number),
									})}
								>
									{number}
								</div>
							))}
						</div>
						<div aria-hidden="true" className="grid grid-flow-col gap-1 justify-center">
							{allColors.map((color) => (
								<div
									key={color}
									className={classNames(
										'w-4 h-4 rounded-full border-black border-2',
										tileBackgroundClasses[color],
										{ 'opacity-30': !notes?.colors.includes(color) },
									)}
								/>
							))}
						</div>
					</div>
				</div>
			</Tooltip>
		</Portal>
	);
}
