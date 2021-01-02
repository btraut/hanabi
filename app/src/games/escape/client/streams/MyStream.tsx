import MyStreamControls from 'app/src/games/escape/client/streams/MyStreamControls';
import MyVideo from 'app/src/games/escape/client/streams/MyVideo';

interface Props {
	stream: MediaStream | null;
	audioOn: boolean;
	videoOn: boolean;
	audioEnabled: boolean;
	videoEnabled: boolean;
	handleAudioToggle: () => void;
	handleVideoToggle: () => void;
}

export default function MyStream({
	stream,
	audioOn,
	videoOn,
	audioEnabled,
	videoEnabled,
	handleAudioToggle,
	handleVideoToggle,
}: Props): JSX.Element {
	return (
		<div className="Streams-MyStream">
			<MyVideo stream={stream} videoOn={videoOn} videoEnabled={videoEnabled} />
			<MyStreamControls
				audioOn={audioOn}
				videoOn={videoOn}
				audioEnabled={audioEnabled}
				videoEnabled={videoEnabled}
				handleAudioToggle={handleAudioToggle}
				handleVideoToggle={handleVideoToggle}
			/>
		</div>
	);
}
