import { useHanabiOptionsContext } from '~/games/hanabi/client/HanabiOptionsContext';
import useActionHighlighter from '~/games/hanabi/client/useActionHighlighter';
import useActionSounds from '~/games/hanabi/client/useActionSounds';

export default function HanabiActionEffects(): null {
	const { playSounds } = useHanabiOptionsContext();

	useActionHighlighter();
	useActionSounds(playSounds);

	return null;
}
