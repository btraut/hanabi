import 'app/sounds/hanabi/right.wav';
import 'app/sounds/hanabi/wrong.wav';
import 'app/sounds/hanabi/beep.wav';

import { HanabiSoundsContextProvider } from 'app/src/games/hanabi/client/HanabiSoundsContext';
import { useMemo, useRef } from 'react';

interface Props {
	readonly children: JSX.Element;
}

export default function HanabiSoundsController({ children }: Props): JSX.Element {
	const rightRef = useRef(new Audio('/sounds/hanabi/right.wav'));
	const wrongRef = useRef(new Audio('/sounds/hanabi/wrong.wav'));
	const beepRef = useRef(new Audio('/sounds/hanabi/beep.wav'));

	const contextValue = useMemo(
		() => ({
			playRight: () => {
				rightRef.current.play();
			},
			playWrong: () => {
				wrongRef.current.play();
			},
			playBeep: () => {
				beepRef.current.play();
			},
		}),
		[],
	);

	return <HanabiSoundsContextProvider value={contextValue}>{children}</HanabiSoundsContextProvider>;
}
