import { useUserId } from 'app/src/components/SocketContext';
import {
	useHanabiAnimationManager,
	useHanabiGame,
} from 'app/src/games/hanabi/client/HanabiContext';
import HanabiMenuButton from 'app/src/games/hanabi/client/HanabiMenuButton';
import HanabiPopup from 'app/src/games/hanabi/client/HanabiPopup';

interface Props {
	onClose?: () => void;
}

export default function HanabiNewGamePopup({ onClose }: Props): JSX.Element | null {
	const game = useHanabiGame();
	const animationManager = useHanabiAnimationManager();
	const { displayGameData: gameData } = animationManager;
	const userId = useUserId();

	return (
		<HanabiPopup background="gray" closeButton onClose={onClose} backgroundWash>
			<div style={{ width: 480 }}>
				<h1 className="italic text-4xl text-white font-normal text-center mb-8">Game Options</h1>
				<div className="grid grid-flow-col gap-x-4 justify-center">
					{gameData.players[userId] && (
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
