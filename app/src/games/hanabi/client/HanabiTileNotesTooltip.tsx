import Portal from 'app/src/components/Portal';
import Tooltip from 'app/src/components/Tooltip';
import { useGameData } from 'app/src/games/hanabi/client/HanabiContext';
import {
	HanabiTileColor,
	HanabiTileNotes,
	HanabiTileNumber,
	tileBackgroundClasses,
} from 'app/src/games/hanabi/HanabiGameData';
import classNames from 'classnames';

export enum HanabiTileActionsTooltipType {
	Own = 'Own',
	OtherPlayer = 'OtherPlayer',
	NoClues = 'NoClues',
}

interface Props {
	notes: HanabiTileNotes | undefined;
	coords: { left: number; top: number };
}

export default function HanabiTileNotesTooltip({ notes, coords }: Props): JSX.Element {
	const gameData = useGameData();

	const allColors: HanabiTileColor[] = ['red', 'blue', 'green', 'yellow', 'white'];
	if (gameData.ruleSet === '6-color') {
		allColors.push('purple');
	}

	const allNumbers: HanabiTileNumber[] = [1, 2, 3, 4, 5];

	return (
		<Portal>
			<Tooltip top={coords.top} left={coords.left} position="below" fadeIn>
				<div className="mt-1">
					<div className="bg-gray-900 rounded-lg pb-2 pt-1 px-2">
						<div className="grid grid-flow-col gap-1.5 justify-center">
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
						<div className="grid grid-flow-col gap-1 justify-center">
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
