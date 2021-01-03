import { useEffect, useRef } from 'react';
import { User } from 'react-feather';

export interface StreamConnection {
	stream: MediaStream | null;
	videoOn: boolean;
	videoEnabled: boolean;
	audioOn: boolean;
	audioEnabled: boolean;
}

interface Props {
	ownStream?: boolean;
	connection: StreamConnection;
}

export default function Stream({
	ownStream = false,
	connection: { videoOn, videoEnabled, audioOn, audioEnabled, stream },
}: Props): JSX.Element | null {
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const videoRef = useRef<HTMLVideoElement | null>(null);

	useEffect(() => {
		const mediaElement = audioRef.current || videoRef.current;
		if (mediaElement && videoOn && videoEnabled) {
			if ('srcObject' in mediaElement) {
				mediaElement.srcObject = stream;
			} else {
				// Older browsers don't support srcObject.
				(mediaElement as any).src = URL.createObjectURL(stream);
			}
		}
	}, [stream, videoEnabled, videoOn]);

	const showVideo = videoOn && videoEnabled;
	const showAudio = !showVideo && audioOn && audioEnabled;

	return (
		<div className="Stream">
			{showVideo ? (
				<video ref={videoRef} autoPlay muted={!ownStream} />
			) : (
				<div className="Stream">
					<User />
				</div>
			)}

			{showAudio && <audio autoPlay ref={audioRef} />}
		</div>
	);
}
