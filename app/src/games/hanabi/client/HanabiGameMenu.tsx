import { useUserId } from 'app/src/components/SocketContext';
import HanabiLinkButton from 'app/src/games/hanabi/client/design-system/HanabiLinkButton';
import HanabiMenuButton from 'app/src/games/hanabi/client/design-system/HanabiMenuButton';
import HanabiPopup from 'app/src/games/hanabi/client/design-system/HanabiPopup';
import {
	useHanabiAnimationManager,
	useHanabiGame,
} from 'app/src/games/hanabi/client/HanabiContext';

interface Props {
	onOptions: () => void;
	onClose: () => void;
}

export default function HanabiGameMenu({ onClose, onOptions }: Props): JSX.Element | null {
	const game = useHanabiGame();
	const animationManager = useHanabiAnimationManager();
	const { displayGameData: gameData } = animationManager;
	const userId = useUserId();

	return (
		<HanabiPopup background="gray" closeButton onClose={onClose} backgroundWash>
			<div style={{ width: 320 }}>
				<h1 className="italic text-4xl text-white font-normal text-center mb-8">Game Menu</h1>
				<div className="grid grid-flow-row gap-8 justify-center">
					<HanabiMenuButton label="Options" onClick={onOptions} />
					{gameData.players[userId] ? (
						<HanabiMenuButton
							label="New Game"
							onClick={() => {
								onClose();
								game.reset();
							}}
						/>
					) : (
						<HanabiLinkButton label="Back to Home" href="/" />
					)}
				</div>
			</div>
		</HanabiPopup>
	);
}
