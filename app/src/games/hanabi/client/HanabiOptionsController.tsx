import LOCAL_STORAGE_KEYS from 'app/src/games/hanabi/client/HanabiLocalStorageManager';
import { HanabiOptionsContextProvider } from 'app/src/games/hanabi/client/HanabiOptionsContext';
import { useLocalStorage } from 'app/src/games/hanabi/client/useLocalStorage';
import { useMemo } from 'react';

interface Props {
	readonly children: JSX.Element | JSX.Element[] | null;
}

export default function HanabiOptionsController({ children }: Props): JSX.Element {
	const [playSounds, setPlaySounds] = useLocalStorage(LOCAL_STORAGE_KEYS.PLAY_SOUNDS, true);

	const contextValue = useMemo(
		() => ({
			playSounds,
			setPlaySounds,
		}),
		[playSounds, setPlaySounds],
	);

	return (
		<HanabiOptionsContextProvider value={contextValue}>{children}</HanabiOptionsContextProvider>
	);
}
