import BreakpointController from '~/components/BreakpointController';
import HanabiBoard from '~/games/hanabi/client/HanabiBoard';
import HanabiDebugPanel from '~/games/hanabi/client/HanabiDebugPanel';
import { useGameData } from '~/games/hanabi/client/HanabiGameContext';
import HanabiHeader from '~/games/hanabi/client/HanabiHeader';
import HanabiHighlightTileController from '~/games/hanabi/client/HanabiHighlightController';
import HanabiLobby from '~/games/hanabi/client/HanabiLobby';
import useTileDrop from '~/games/hanabi/client/useTileDrop';
import { HanabiStage } from '@hanabi/shared';
import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export default function HanabiGameView(): JSX.Element | null {
	const gameData = useGameData();
	const { search } = useLocation();
	const [debugPanelOpen, setDebugPanelOpen] = useState(
		() => new URLSearchParams(search).get('debug') === '1',
	);

	useEffect(() => {
		if (!import.meta.env.DEV) return;

		const toggleDebugPanel = (event: KeyboardEvent) => {
			if (
				event.altKey &&
				!event.ctrlKey &&
				!event.metaKey &&
				event.code === 'KeyD' &&
				!event.repeat
			) {
				event.preventDefault();
				setDebugPanelOpen((open) => !open);
			}
		};

		window.addEventListener('keydown', toggleDebugPanel);
		return () => window.removeEventListener('keydown', toggleDebugPanel);
	}, []);

	const showDebugPanel = import.meta.env.DEV && debugPanelOpen;

	// The entire screen should be used as a drop target. This is to work around a
	// limitation of react-dnd where the "return animation" is played when
	// dropping things outside drop targets.
	const dropRef = useTileDrop();
	const connectDropTarget = useCallback(
		(element: HTMLDivElement | null) => {
			dropRef(element);
		},
		[dropRef],
	);

	return (
		<>
			{gameData.stage === HanabiStage.Setup && <HanabiLobby />}
			{(gameData.stage === HanabiStage.Playing || gameData.stage === HanabiStage.Finished) && (
				<HanabiHighlightTileController>
					<BreakpointController>
						<div
							className="w-screen min-h-screen grid grid-flow-row gap-6 content-start"
							ref={connectDropTarget}
						>
							<HanabiHeader />
							<div className="justify-self-center">
								<HanabiBoard />
							</div>
							<div id="portal" />
						</div>
					</BreakpointController>
				</HanabiHighlightTileController>
			)}
			{showDebugPanel && <HanabiDebugPanel />}
		</>
	);
}
