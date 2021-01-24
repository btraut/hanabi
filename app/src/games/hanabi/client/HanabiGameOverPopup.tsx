import { useUserId } from 'app/src/components/SocketContext';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import HanabiMenuButton from 'app/src/games/hanabi/client/HanabiMenuButton';
import HanabiPopup from 'app/src/games/hanabi/client/HanabiPopup';
import { HanabiFinishedReason } from 'app/src/games/hanabi/HanabiGameData';

const GAME_OVER_TITLES: { [key in HanabiFinishedReason]: string } = {
	Won: 'Congratulations!',
	DiscardedFatalTile: 'Game over!',
	OutOfTurns: 'Game over!',
	OutOfLives: 'Game over!',
};

const GAME_OVER_MESSAGES: { [key in HanabiFinishedReason]: string } = {
	Won: 'You won!',
	DiscardedFatalTile: 'You no longer have the tiles needed to win.',
	OutOfTurns: 'You ran out of turns.',
	OutOfLives: 'You ran out of lives.',
};

interface Props {
	onClose?: () => void;
}

export default function HanabiGameOverPopup({ onClose }: Props): JSX.Element | null {
	const game = useHanabiGame();
	const userId = useUserId();

	const { finishedReason } = game.gameData;
	if (finishedReason === null) {
		return null;
	}

	return (
		<HanabiPopup background={finishedReason === HanabiFinishedReason.Won ? 'green' : 'red'}>
			<div style={{ width: 480 }}>
				<h1 className="italic text-4xl text-white font-normal text-center mb-2">
					{GAME_OVER_TITLES[finishedReason]}
				</h1>
				<p className="italic text-2xl text-white font-normal text-center mb-8">
					{GAME_OVER_MESSAGES[finishedReason]}
				</p>
				<div className="grid grid-flow-col gap-x-4 justify-center">
					{onClose && <HanabiMenuButton label="Show Tiles" onClick={onClose} />}
					{game.gameData.players[userId] && (
						<HanabiMenuButton
							label="New Game"
							onClick={() => {
								if (onClose) {
									onClose();
								}

								game.reset();
							}}
						/>
					)}
				</div>
			</div>
		</HanabiPopup>
	);
}
