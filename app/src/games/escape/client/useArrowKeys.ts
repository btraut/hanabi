import { Direction } from 'app/src/games/escape/Movement';
import { useCallback, useEffect } from 'react';

type ArrowKeyHandler = (direction: Direction) => void;

export default function useArrowKeys(handler: ArrowKeyHandler): void {
	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			console.log(event.key);

			switch (event.key) {
				case 'ArrowUp':
					handler(Direction.Up);
					break;
				case 'ArrowLeft':
					handler(Direction.Left);
					break;
				case 'ArrowRight':
					handler(Direction.Right);
					break;
				case 'ArrowDown':
					handler(Direction.Down);
					break;
			}
		},
		[handler],
	);

	useEffect(() => {
		console.log('adding keydown');
		document.addEventListener('keydown', handleKeyDown);

		return () => {
			document.removeEventListener('keydown', handleKeyDown);
		};
	}, [handleKeyDown]);
}
