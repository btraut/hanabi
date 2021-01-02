import React, { useCallback, useEffect, useRef } from 'react';
import { User } from 'react-feather';

interface Props {
	stream: MediaStream | null;
	videoOn: boolean;
	videoEnabled: boolean;
}

export default function MyVideo({ stream, videoOn, videoEnabled }: Props): JSX.Element {
	const videoRef = useRef<HTMLVideoElement | null>(null);

	const updateSrcObject = useCallback(() => {
		if (videoRef.current && videoOn && videoEnabled) {
			if ('srcObject' in videoRef.current) {
				videoRef.current.srcObject = stream;
			} else {
				// Older browsers don't support srcObject.
				(videoRef.current as any).src = URL.createObjectURL(stream);
			}
		}
	}, [stream, videoEnabled, videoOn]);

	useEffect(() => {
		updateSrcObject();
	}, [updateSrcObject]);

	if (videoEnabled && videoOn) {
		return <video ref={videoRef} autoPlay muted />;
	} else {
		return <User />;
	}
}
