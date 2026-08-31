import { useUserId } from '~/components/SocketContext';
import HanabiDialog from '~/games/hanabi/client/design-system/HanabiDialog';
import HanabiMenuButton from '~/games/hanabi/client/design-system/HanabiMenuButton';
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
	onClose: () => void;
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
		<HanabiDialog
			onClose={onClose}
			title={GAME_OVER_TITLES[finishedReason]}
			tone={finishedReason === HanabiFinishedReason.Won ? 'success' : 'danger'}
		>
			<div className="grid gap-6">
				<p className="text-lg leading-6 text-hanabi-text-muted">
					{GAME_OVER_MESSAGES[finishedReason]}
				</p>
				<div className="flex justify-end">
					{gameData.players[userId] && (
						<HanabiMenuButton
							label="New game"
							onClick={() => {
								onClose();

								void gameMessenger.reset().catch((error: unknown) => {
									console.error('Could not reset the game:', error);
								});
							}}
							variant="primary"
						/>
					)}
				</div>
			</div>
		</HanabiDialog>
	);
}
