import classnames from 'classnames';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff } from 'react-feather';

interface Props {
	audioOn: boolean;
	videoOn: boolean;
	audioEnabled: boolean;
	videoEnabled: boolean;
	handleVideoToggle: () => void;
	handleAudioToggle: () => void;
}

export default function MyStreamControls({
	audioOn,
	videoOn,
	audioEnabled,
	videoEnabled,
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
						'MyStreamControls-ToggleButton--On': videoOn,
					},
				])}
				onClick={handleVideoToggle}
				disabled={!videoEnabled}
			>
				{videoOn && videoEnabled ? <Video /> : <VideoOff />}
			</button>
			<button
				className={classnames([
					'MyStreamControls-ToggleButton',
					{
						'MyStreamControls-ToggleButton--On': audioOn,
					},
				])}
				onClick={handleAudioToggle}
				disabled={!audioEnabled}
			>
				{audioOn && audioEnabled ? <Mic /> : <MicOff />}
			</button>
		</div>
	);
}
