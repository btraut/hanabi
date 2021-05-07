import { useGameData } from 'app/src/games/hanabi/client/HanabiGameContext';
import HanabiTileView, { TileViewSize } from 'app/src/games/hanabi/client/HanabiTileView';
import {
	HanabiGameActionDiscard,
	HanabiGameActionGiveClue,
	HanabiGameActionPlay,
	HanabiGameActionType,
	tileBackgroundClasses,
} from 'app/src/games/hanabi/HanabiGameData';
import classNames from 'classnames';

interface Props {
	action: HanabiGameActionPlay | HanabiGameActionDiscard | HanabiGameActionGiveClue;
}

const ENGLISH_NUMBERS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];

export default function HanabiTileActionBody({ action }: Props): JSX.Element | null {
	const gameData = useGameData();

	const player = gameData.players[action.playerId];

	if (action.type === HanabiGameActionType.Play) {
		if (action.valid) {
			return (
				<>
					<span className="align-middle">
						<span className="font-bold">{player.name}</span> played
					</span>
					<div className="inline-block align-middle mx-2">
						<HanabiTileView
							color={action.tile.color}
							number={action.tile.number}
							size={TileViewSize.Small}
						/>
					</div>
					<span className="align-middle">{action.tile.number === 5 && 'and created a clue'}</span>
				</>
			);
		} else {
			return (
				<>
					<span className="align-middle">
						<span className="font-bold">{player.name}</span> played
					</span>
					<div className="inline-block align-middle mx-2">
						<HanabiTileView
							color={action.tile.color}
							number={action.tile.number}
							size={TileViewSize.Small}
						/>
					</div>
					<span className="align-middle">but it was invalid</span>
				</>
			);
		}
	} else if (action.type === HanabiGameActionType.Discard) {
		return (
			<>
				<span className="align-middle">
					<span className="font-bold">{player.name}</span> discarded
				</span>
				<div className="inline-block align-middle mx-2">
					<HanabiTileView
						color={action.tile.color}
						number={action.tile.number}
						size={TileViewSize.Small}
					/>
				</div>
			</>
		);
	} else if (
		action.type === HanabiGameActionType.GiveColorClue ||
		action.type === HanabiGameActionType.GiveNumberClue
	) {
		const recipient = gameData.players[action.recipientId];

		const clue =
			action.type === HanabiGameActionType.GiveColorClue ? (
				<div
					className={classNames(
						'inline-block align-middle w-6 h-6 rounded-full border-black border-4 mx-1.5',
						tileBackgroundClasses[action.color!],
					)}
				/>
			) : (
				<span className="align-middle">
					{' '}
					<span className="font-bold">{action.number!}</span>
					{action.tiles.length === 1 ? '' : 's'}
				</span>
			);

		return (
			<>
				<span className="align-middle">
					<span className="font-bold">{player.name}</span> →{' '}
					<span className="font-bold">{recipient.name}</span>:{' '}
					{ENGLISH_NUMBERS[action.tiles.length]}{' '}
					{action.tiles.length === 1 ? 'tile is a' : 'tiles are'}
				</span>
				{clue}
			</>
		);
	}

	return null;
}
