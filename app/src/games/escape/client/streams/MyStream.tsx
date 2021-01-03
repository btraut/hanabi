import MyStreamControls from 'app/src/games/escape/client/streams/MyStreamControls';
import Stream, { StreamConnection } from 'app/src/games/escape/client/streams/Stream';

interface Props {
	connection: StreamConnection;
	handleAudioToggle: () => void;
	handleVideoToggle: () => void;
}

export default function MyStream({
	connection,
	handleAudioToggle,
	handleVideoToggle,
}: Props): JSX.Element {
	return (
		<div className="Streams-MyStream">
			<Stream ownStream connection={connection} />
			<MyStreamControls
				connection={connection}
				handleAudioToggle={handleAudioToggle}
				handleVideoToggle={handleVideoToggle}
			/>
		</div>
	);
}
