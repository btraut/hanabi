import MyStream from 'app/src/games/escape/client/streams/MyStream';
import PeerStreams from 'app/src/games/escape/client/streams/PeerStreams';
import RequestPermissionsButton from 'app/src/games/escape/client/streams/RequestPermissionsButton';
import { StreamConnection } from 'app/src/games/escape/client/streams/Stream';
import useSignalHubManager from 'app/src/games/escape/client/streams/useSignalHubManager';
import { useCallback, useState } from 'react';

interface Props {
	hubId: string;
	userId: string;
	includeViewer: boolean;
}

export default function Streams({ hubId, userId, includeViewer }: Props): JSX.Element {
	const [myConnection, setMyConnection] = useState<StreamConnection | null>(null);

	const signalHubManager = useSignalHubManager(hubId);

	const handleRequestPermissions = useCallback(
		(result: { stream: MediaStream | null; audioEnabled: boolean; videoEnabled: boolean }) => {
			setMyConnection({
				...result,
				audioOn: true,
				videoOn: true,
			});

			signalHubManager.connect({
				userId,
				stream: result.stream,
				audioOn: result.audioEnabled,
				videoOn: result.videoEnabled,
			});
		},
		[signalHubManager, userId],
	);

	const handleToggleAudio = useCallback(() => {
		if (myConnection) {
			const audioOn = !myConnection.audioOn;

			setMyConnection({
				...myConnection,
				audioOn,
			});

			signalHubManager.audioOn = audioOn;
		}
	}, [myConnection, signalHubManager]);
	const handleToggleVideo = useCallback(() => {
		if (myConnection) {
			const videoOn = !myConnection.videoOn;

			setMyConnection({
				...myConnection,
				videoOn,
			});

			signalHubManager.audioOn = videoOn;
		}
	}, [myConnection, signalHubManager]);

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
			<PeerStreams
				peerStreams={signalHubManager.peerStreams}
				swarmInitialized={signalHubManager.swarmInitialized}
			/>
		</div>
	);
}
