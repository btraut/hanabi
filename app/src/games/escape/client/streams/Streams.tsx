import MyStream from 'app/src/games/escape/client/streams/MyStream';
import RequestPermissionsButton from 'app/src/games/escape/client/streams/RequestPermissionsButton';
import { useCallback, useState } from 'react';

interface Props {
	id: string;
	includeViewer: boolean;
}

export default function Streams({ includeViewer }: Props): JSX.Element {
	const [initialized, setInitialized] = useState(false);
	const [audioEnabled, setAudioEnabled] = useState(false);
	const [videoEnabled, setVideoEnabled] = useState(false);
	const [audioOn, setAudioOn] = useState(true);
	const [videoOn, setVideoOn] = useState(true);
	const [myStream, setMyStream] = useState<MediaStream | null>(null);

	const handleRequestPermissions = (result: {
		myStream: MediaStream | null;
		audioEnabled: boolean;
		videoEnabled: boolean;
	}) => {
		setInitialized(true);
		setAudioEnabled(result.audioEnabled);
		setVideoEnabled(result.videoEnabled);
		setMyStream(result.myStream);
	};

	const handleToggleAudio = useCallback(() => {
		setAudioOn(!audioOn);
	}, [audioOn]);
	const handleToggleVideo = useCallback(() => {
		setVideoOn(!videoOn);
	}, [videoOn]);

	return (
		<div className="Streams">
			{includeViewer &&
				(initialized ? (
					<MyStream
						stream={myStream}
						audioOn={audioOn}
						videoOn={videoOn}
						audioEnabled={audioEnabled}
						videoEnabled={videoEnabled}
						handleAudioToggle={handleToggleAudio}
						handleVideoToggle={handleToggleVideo}
					/>
				) : (
					<RequestPermissionsButton onPermissionsRequested={handleRequestPermissions} />
				))}
		</div>
	);
}
