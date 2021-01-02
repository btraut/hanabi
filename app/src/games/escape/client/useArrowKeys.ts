import { Direction } from 'app/src/games/escape/Movement';
import { useCallback, useEffect } from 'react';

type ArrowKeyHandler = (direction: Direction) => void;

export default function useArrowKeys(handler: ArrowKeyHandler): void {
	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			switch (event.key) {
				case 'ArrowUp':
					event.preventDefault();
					handler(Direction.Up);
					break;
				case 'ArrowLeft':
					event.preventDefault();
					handler(Direction.Left);
					break;
				case 'ArrowRight':
					event.preventDefault();
					handler(Direction.Right);
					break;
				case 'ArrowDown':
					event.preventDefault();
					handler(Direction.Down);
					break;
			}
		},
		[handler],
	);

	useEffect(() => {
		document.addEventListener('keydown', handleKeyDown);

		return () => {
			document.removeEventListener('keydown', handleKeyDown);
		};
	}, [handleKeyDown]);
}
