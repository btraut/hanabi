import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import { useHanabiHighlightTileContext } from 'app/src/games/hanabi/client/HanabiHighlightTileContext';
import HanabiTileView, { TileViewSize } from 'app/src/games/hanabi/client/HanabiTileView';
import {
	HanabiGameActionDiscard,
	HanabiGameActionGiveClue,
	HanabiGameActionPlay,
	HanabiGameActionType,
	tileBackgroundClasses,
} from 'app/src/games/hanabi/HanabiGameData';
import classnames from 'classnames';
import { useCallback } from 'react';

interface Props {
	action: HanabiGameActionPlay | HanabiGameActionDiscard | HanabiGameActionGiveClue;
}

const ENGLISH_NUMBERS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];

export default function HanabiTileAction({ action }: Props): JSX.Element {
	const game = useHanabiGame();

	const { highlightTiles } = useHanabiHighlightTileContext();

	const handleMouseEnter = useCallback(() => {
		const tilesToHighlight = new Set<string>();

		if (action.type === HanabiGameActionType.Play || action.type === HanabiGameActionType.Discard) {
			tilesToHighlight.add(action.tile.id);
		} else if (
			action.type === HanabiGameActionType.GiveColorClue ||
			action.type === HanabiGameActionType.GiveNumberClue
		) {
			for (const tile of action.tiles) {
				tilesToHighlight.add(tile.id);
			}
		}

		highlightTiles(tilesToHighlight);
	}, [action, highlightTiles]);
	const handleMouseLeave = useCallback(() => {
		highlightTiles(new Set());
	}, [highlightTiles]);

	const player = game.gameData.players[action.playerId];
	let actionContent: JSX.Element | null = null;

	if (action.type === HanabiGameActionType.Play) {
		if (action.valid) {
			actionContent = (
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
				</>
			);
		} else {
			actionContent = (
				<>
					<span className="align-middle">
						<span className="font-bold">{player.name}</span> tried, but failed to play
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
		}
	} else if (action.type === HanabiGameActionType.Discard) {
		actionContent = (
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
		const recipient = game.gameData.players[action.recipientId];

		const clue =
			action.type === HanabiGameActionType.GiveColorClue ? (
				<div
					className={classnames(
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

		actionContent = (
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

	return (
		<div
			className="text-md xl:text-lg p-4 cursor-zoom-in"
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
		>
			{actionContent}
		</div>
	);
}
