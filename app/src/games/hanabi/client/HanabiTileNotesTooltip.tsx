import Portal from 'app/src/components/Portal';
import Tooltip from 'app/src/components/Tooltip';
import { useHanabiAnimationManager } from 'app/src/games/hanabi/client/HanabiContext';
import {
	HanabiTileColor,
	HanabiTileNotes,
	HanabiTileNumber,
	tileBackgroundClasses,
} from 'app/src/games/hanabi/HanabiGameData';
import classnames from 'classnames';

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
	const animationManager = useHanabiAnimationManager();
	const { displayGameData: gameData } = animationManager;

	const allColors: HanabiTileColor[] = ['red', 'blue', 'green', 'yellow', 'white'];
	if (gameData.ruleSet === '6-color') {
		allColors.push('purple');
	}

	const allNumbers: HanabiTileNumber[] = [1, 2, 3, 4, 5];

	return (
		<Portal>
			<Tooltip top={coords.top} left={coords.left} position="below">
				<div className="pb-0.5">
					<div className="flex justify-center">
						<div
							style={{
								borderLeftColor: 'transparent',
								borderRightColor: 'transparent',
								borderBottomWidth: 12,
								borderLeftWidth: 12,
								borderRightWidth: 12,
							}}
							className="border-gray-900"
						/>
					</div>
					<div className="bg-gray-900 rounded-lg py-2 px-3">
						<div className="grid grid-flow-col gap-2 justify-center">
							{allNumbers.map((number) => (
								<div
									key={number}
									className={classnames('font-bold text-xl text-white', {
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
									className={classnames(
										'w-6 h-6 rounded-full border-black border-4',
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
