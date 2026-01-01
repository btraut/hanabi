import { useUserId } from '~/components/SocketContext';
import HanabiMenuButton from '~/games/hanabi/client/design-system/HanabiMenuButton';
import HanabiPopup from '~/games/hanabi/client/design-system/HanabiPopup';
import { useGameData, useGameMessenger } from '~/games/hanabi/client/HanabiGameContext';
import { HanabiFinishedReason } from '@hanabi/shared';

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
	const gameMessenger = useGameMessenger();
	const gameData = useGameData();
	const userId = useUserId();

	const { finishedReason } = gameData;
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
					{gameData.players[userId] && (
						<HanabiMenuButton
							label="New Game"
							onClick={() => {
								if (onClose) {
									onClose();
								}

								gameMessenger.reset();
							}}
						/>
					)}
					<HanabiMenuButton label="Close" onClick={onClose} />
				</div>
			</div>
		</HanabiPopup>
	);
}
