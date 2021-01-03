import { StreamConnection } from 'app/src/games/escape/client/streams/Stream';
import classnames from 'classnames';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff } from 'react-feather';

interface Props {
	connection: StreamConnection;
	handleVideoToggle: () => void;
	handleAudioToggle: () => void;
}

export default function MyStreamControls({
	connection,
	handleVideoToggle,
	handleAudioToggle,
}: Props): JSX.Element {
	const [showControls, setShowControls] = useState(false);
	const interactionTimeoutHandleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const handleInteraction = useCallback(() => {
		if (interactionTimeoutHandleRef.current !== null) {
			clearTimeout(interactionTimeoutHandleRef.current);
		}

		interactionTimeoutHandleRef.current = setTimeout(() => {
			setShowControls(false);
			interactionTimeoutHandleRef.current = null;
		}, 3000);

		setShowControls(true);
	}, []);

	useEffect(() => {
		window.addEventListener('mousemove', handleInteraction);
		window.addEventListener('touchstart', handleInteraction);

		return () => {
			window.removeEventListener('mousemove', handleInteraction);
			window.removeEventListener('touchstart', handleInteraction);
		};
	});

	return (
		<div
			className={classnames([
				'MyStreamControls',
				{
					'MyStreamControls--Hidden': !showControls,
				},
			])}
		>
			<button
				className={classnames([
					'MyStreamControls-ToggleButton',
					{
						'MyStreamControls-ToggleButton--On': connection.videoOn,
					},
				])}
				onClick={handleVideoToggle}
				disabled={!connection.videoEnabled}
			>
				{connection.videoOn && connection.videoEnabled ? <Video /> : <VideoOff />}
			</button>
			<button
				className={classnames([
					'MyStreamControls-ToggleButton',
					{
						'MyStreamControls-ToggleButton--On': connection.audioOn,
					},
				])}
				onClick={handleAudioToggle}
				disabled={!connection.audioEnabled}
			>
				{connection.audioOn && connection.audioEnabled ? <Mic /> : <MicOff />}
			</button>
		</div>
	);
}
