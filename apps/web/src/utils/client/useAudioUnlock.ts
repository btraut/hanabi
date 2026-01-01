// useAudioUnlock is a hack to make audio work on browsers where auto-play is
// disabled such as Safari. Those browsers will allow auto-play to be "unlocked"
// if at least one sound has been played in response to a user click/touch. This
// hack installs a click handler on the body to play, then immediately pause a
// sound on click, thus unlocking future sounds but not bothering the user in
// the meantime.

import { useCallback, useEffect } from 'react';

export default function useAudioUnlock(): void {
	const unlockAudio = useCallback(() => {
		const sound = new Audio('/sounds/hanabi/right.wav');

		sound.play().catch(() => {
			// no-op
		});
		sound.pause();
		sound.currentTime = 0;

		document.body.removeEventListener('click', unlockAudio);
		document.body.removeEventListener('touchstart', unlockAudio);
	}, []);

	useEffect(() => {
		document.body.addEventListener('click', unlockAudio);
		document.body.addEventListener('touchstart', unlockAudio);
	}, [unlockAudio]);
}
