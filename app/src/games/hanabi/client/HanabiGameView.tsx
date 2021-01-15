import { useSocket } from 'app/src/components/SocketContext';
import HanabiBoard from 'app/src/games/hanabi/client/HanabiBoard';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import HanabiHighlightTileController from 'app/src/games/hanabi/client/HanabiHighlightTileController';
import HanabiLobby from 'app/src/games/hanabi/client/HanabiLobby';
import { HanabiStage } from 'app/src/games/hanabi/HanabiGameData';

export default function HanabiGameView(): JSX.Element | null {
	const game = useHanabiGame();
	const { userId } = useSocket();

	if (!game || !userId) {
		throw new Error('Must connect/join. This should never happen.');
	}

	return (
		<div className="flex flex-col items-center">
			{game.gameData.stage === HanabiStage.Setup && <HanabiLobby />}
			{(game.gameData.stage === HanabiStage.Playing ||
				game.gameData.stage === HanabiStage.Finished) && (
				<HanabiHighlightTileController>
					<HanabiBoard />
				</HanabiHighlightTileController>
			)}
		</div>
	);
}
