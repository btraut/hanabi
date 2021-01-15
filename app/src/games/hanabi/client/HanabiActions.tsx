import { useSocket } from 'app/src/components/SocketContext';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import HanabiLives from 'app/src/games/hanabi/client/HanabiLives';
import HanabiTileView from 'app/src/games/hanabi/client/HanabiTileView';
import {
	HANABI_MAX_LIVES,
	HanabiGameActionType,
	tileBackgroundClasses,
} from 'app/src/games/hanabi/HanabiGameData';
import classnames from 'classnames';

export default function HanabiActions(): JSX.Element {
	const { userId } = useSocket();
	const game = useHanabiGame();

	if (!game || !userId) {
		throw new Error('Must connect/join. This should never happen.');
	}

	const actionsReversed = [...game.gameData.actions].reverse();

	return (
		<div>
			{actionsReversed.length === 0 && (
				<p className="italic text-lg color-gray-600 p-4">No actions yet!</p>
			)}
			{actionsReversed.map((action, index) => {
				const player = game.gameData.players[action.playerId];
				let actionContent: JSX.Element | null = null;

				if (action.type === HanabiGameActionType.Play) {
					if (action.valid) {
						actionContent = (
							<>
								<span>
									<span className="font-bold">{player.name}</span> played
								</span>
								<div className="inline-block mx-2">
									<HanabiTileView tile={action.tile} />
								</div>
							</>
						);
					} else {
						actionContent = (
							<>
								<span>
									<span className="font-bold">{player.name}</span> played
								</span>
								<div className="inline-block align-middle mx-2">
									<HanabiTileView tile={action.tile} />
								</div>
								<span>but it was invalid and was discarded:</span>
								<div className="inline-block align-middle mx-2">
									<HanabiLives lives={action.remainingLives} maxLives={HANABI_MAX_LIVES} />
								</div>
							</>
						);
					}
				} else if (action.type === HanabiGameActionType.Discard) {
					actionContent = (
						<>
							<span>
								<span className="font-bold">{player.name}</span> discarded
							</span>
							<div className="inline-block align-middle mx-2">
								<HanabiTileView tile={action.tile} />
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
									'inline-block align-middle w-6 h-6 rounded-full border-solid border-black border-4 mx-1',
									tileBackgroundClasses[action.color!],
								)}
							/>
						) : (
							<span className="inline-block mx-1">
								<span className="font-bold">{action.number!}</span>
								{action.tiles.length === 1 ? '' : 's'}
							</span>
						);

					actionContent = (
						<>
							<span>
								<span className="font-bold">{player.name}</span> gave a clue to{' '}
								<span className="font-bold">{recipient.name}</span>: {action.tiles.length}{' '}
								{action.tiles.length === 1 ? 'tile is a' : 'tiles are'}
							</span>
							{clue}
						</>
					);
				}

				return (
					<div
						className={classnames('border-solid border-gray-600 p-4 text-lg', {
							'border-t-2': index !== 0,
						})}
						key={action.id}
					>
						{actionContent}
					</div>
				);
			})}
		</div>
	);
}
