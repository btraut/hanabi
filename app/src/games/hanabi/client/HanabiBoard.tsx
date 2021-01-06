import { useSocket } from 'app/src/components/SocketContext';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';

export default function HanabiBoard(): JSX.Element {
	const { userId } = useSocket();
	const game = useHanabiGame();

	if (!game || !userId) {
		throw new Error('Must connect/join. This should never happen.');
	}

	return (
		<>
			<h1 className="Hanabi-Subtitle">Game on!</h1>
			<p className="Hanabi-Board">This is a Hanabi game board!</p>
		</>
	);
}
