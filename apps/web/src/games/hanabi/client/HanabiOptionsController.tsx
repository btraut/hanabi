import LOCAL_STORAGE_KEYS from '~/games/hanabi/client/HanabiLocalStorageManager';
import { HanabiOptionsContextProvider } from '~/games/hanabi/client/HanabiOptionsContext';
import { useLocalStorage } from '~/games/hanabi/client/useLocalStorage';
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
