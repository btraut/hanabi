import { ReactNode, useLayoutEffect, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { HanabiActionTransitionCoordinator } from './HanabiActionTransition';
import { HanabiBoardData, SnapshotChannel } from './HanabiGameStore';
import { useHanabiGameContext } from './HanabiGameContext';

import {
	HanabiBoardPresentationContext,
	HanabiBoardPresentationSnapshot,
} from './HanabiBoardPresentationContext';

export default function HanabiBoardPresentation({
	children,
}: {
	children: ReactNode;
}): JSX.Element {
	const { store } = useHanabiGameContext();
	const presentation = useMemo(
		() =>
			new SnapshotChannel<HanabiBoardPresentationSnapshot>({
				gameData: store.board.getSnapshot()!,
				transitioningTileId: null,
			}),
		[store],
	);
	useLayoutEffect(() => {
		const publish = (next: HanabiBoardPresentationSnapshot) => {
			if (presentation.prepare(next)) flushSync(() => presentation.publish());
		};
		const coordinator = new HanabiActionTransitionCoordinator<HanabiBoardData>({
			applyState: (gameData, transitioningTileId) => publish({ gameData, transitioningTileId }),
			markTransitioningTile: (transitioningTileId) =>
				publish({ ...presentation.getSnapshot(), transitioningTileId }),
			clearTransitioningTile: () =>
				publish({ ...presentation.getSnapshot(), transitioningTileId: null }),
			prefersReducedMotion: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
			startTransition:
				'startViewTransition' in document
					? (update) => document.startViewTransition(update)
					: undefined,
		});
		coordinator.update(store.board.getSnapshot()!);
		const unsubscribe = store.board.subscribe(() => coordinator.update(store.board.getSnapshot()!));
		return () => {
			unsubscribe();
			coordinator.cleanUp();
		};
	}, [presentation, store]);
	return (
		<HanabiBoardPresentationContext.Provider value={presentation}>
			{children}
		</HanabiBoardPresentationContext.Provider>
	);
}
