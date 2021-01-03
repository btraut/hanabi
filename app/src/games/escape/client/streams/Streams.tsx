import MyStream from 'app/src/games/escape/client/streams/MyStream';
import RequestPermissionsButton from 'app/src/games/escape/client/streams/RequestPermissionsButton';
import { StreamConnection } from 'app/src/games/escape/client/streams/Stream';
import { useCallback, useState } from 'react';

interface Props {
	includeViewer: boolean;
}

export default function Streams({ includeViewer }: Props): JSX.Element {
	const [myConnection, setMyConnection] = useState<StreamConnection | null>(null);

	const handleRequestPermissions = useCallback(
		(result: { stream: MediaStream | null; audioEnabled: boolean; videoEnabled: boolean }) => {
			setMyConnection({
				...result,
				audioOn: true,
				videoOn: true,
			});
		},
		[],
	);

	const handleToggleAudio = useCallback(() => {
		if (myConnection) {
			const audioOn = !myConnection.audioOn;

			setMyConnection({
				...myConnection,
				audioOn,
			});
		}
	}, [myConnection]);
	const handleToggleVideo = useCallback(() => {
		if (myConnection) {
			const videoOn = !myConnection.videoOn;

			setMyConnection({
				...myConnection,
				videoOn,
			});
		}
	}, [myConnection]);

	return (
		<div className="Streams">
			{includeViewer &&
				(myConnection ? (
					<MyStream
						connection={myConnection}
						handleAudioToggle={handleToggleAudio}
						handleVideoToggle={handleToggleVideo}
					/>
				) : (
					<RequestPermissionsButton onPermissionsRequested={handleRequestPermissions} />
				))}
		</div>
	);
}
