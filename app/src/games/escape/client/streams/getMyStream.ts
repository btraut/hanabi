async function getMediaStream(options?: MediaStreamConstraints) {
	return navigator.mediaDevices.getUserMedia(options);
}

export default async function getMyStream(): Promise<{
	stream: MediaStream | null;
	audioEnabled: boolean;
	videoEnabled: boolean;
}> {
	const video = {
		facingMode: 'user',
		width: { min: 640, ideal: 1280, max: 1920 },
		height: { min: 360, ideal: 720, max: 1080 },
		frameRate: { ideal: 15, max: 24 },
	};
	const audio = {
		autoGainControl: true,
		sampleRate: { ideal: 48000, min: 35000 },
		echoCancellation: true,
		channelCount: { ideal: 1 },
	};

	// Try and get video and audio.
	try {
		console.log('Loading audio/video stream.');
		const stream = await getMediaStream({ video, audio });
		return { stream, audioEnabled: true, videoEnabled: true };
	} catch (error) {
		console.error(error);
	}

	// If that fails, try just audio.
	try {
		console.log('Loading audio stream.');
		const stream = await getMediaStream({ audio });
		return { stream, audioEnabled: true, videoEnabled: false };
	} catch (error) {
		console.error(error);
	}

	// If that fails, try just video.
	try {
		console.log('Loading video stream.');
		const stream = await getMediaStream({ video });
		return { stream, audioEnabled: false, videoEnabled: true };
	} catch (error) {
		console.error(error);
		return { stream: null, audioEnabled: false, videoEnabled: false };
	}
}
