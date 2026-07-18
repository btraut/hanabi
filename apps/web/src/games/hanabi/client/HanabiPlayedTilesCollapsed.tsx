import { useGameData, useTransitioningTileId } from '~/games/hanabi/client/HanabiGameContext';
import { getTileViewTransitionName } from '~/games/hanabi/client/HanabiActionTransition';
import HanabiTileView, { TileViewSize } from '~/games/hanabi/client/HanabiTileView';
import {
	getHanabiFireworkSequence,
	getHanabiMaxScore,
	getHanabiRuleSetColors,
	getHanabiScore,
} from '@hanabi/shared';
import classNames from 'classnames';

export default function HanabiPlayedTiles(): JSX.Element {
	const gameData = useGameData();
	const transitioningTileId = useTransitioningTileId();

	const colors = getHanabiRuleSetColors(gameData.ruleSet);
	const score = getHanabiScore(gameData);
	const maxScore = getHanabiMaxScore(gameData.ruleSet);

	return (
		<div className="grid grid-flow-col justify-start gap-1 items-center">
			{colors.map((color) => {
				const fireworkSequence = getHanabiFireworkSequence(color);
				const coloredTiles = gameData.playedTiles
					.map((tid) => gameData.tiles[tid])
					.filter((t) => t.color === color)
					.sort((a, b) => fireworkSequence.indexOf(a.number) - fireworkSequence.indexOf(b.number));
				const topTile = coloredTiles.length === 0 ? null : coloredTiles[coloredTiles.length - 1];

				return (
					<div
						key={`color-${color}`}
						className={classNames({
							'opacity-20': topTile === null,
						})}
					>
						<HanabiTileView
							color={color}
							number={topTile === null ? fireworkSequence[0] : topTile.number}
							size={TileViewSize.Small}
							viewTransitionName={
								topTile !== null && transitioningTileId === topTile.id
									? getTileViewTransitionName(topTile.id)
									: undefined
							}
						/>
					</div>
				);
			})}
			<div className="text-lg font-bold mx-1">{`${score}/${maxScore}`}</div>
		</div>
	);
}
