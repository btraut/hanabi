import { useUserId } from 'app/src/components/SocketContext';
import HanabiLinkButton from 'app/src/games/hanabi/client/design-system/HanabiLinkButton';
import HanabiMenuButton from 'app/src/games/hanabi/client/design-system/HanabiMenuButton';
import HanabiPopup from 'app/src/games/hanabi/client/design-system/HanabiPopup';
import { useGameData, useGameMessenger } from 'app/src/games/hanabi/client/HanabiGameContext';

interface Props {
	onOptions: () => void;
	onClose: () => void;
}

export default function HanabiGameMenu({ onClose, onOptions }: Props): JSX.Element | null {
	const gameMessenger = useGameMessenger();
	const gameData = useGameData();
	const userId = useUserId();

	return (
		<HanabiPopup background="gray" onClose={onClose} backgroundWash>
			<div style={{ width: 320 }}>
				<h1 className="italic text-4xl text-white font-normal text-center mb-8">Game Menu</h1>
				<div className="grid grid-flow-row gap-8 justify-center">
					{gameData.players[userId] ? (
						<HanabiMenuButton
							label="New Game"
							onClick={() => {
								onClose();
								gameMessenger.reset();
							}}
						/>
					) : (
						<HanabiLinkButton label="Back to Home" href="/" />
					)}
					<div className="grid grid-flow-row gap-4">
						<HanabiMenuButton label="Options" onClick={onOptions} />
						<HanabiMenuButton label="Close" onClick={onClose} />
					</div>
				</div>
			</div>
		</HanabiPopup>
	);
}
