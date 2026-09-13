import { HANABI_DESKTOP_TILE_SIZE } from './HanabiDesktopTileGeometry';
import HanabiTileView from '~/games/hanabi/client/HanabiTileView';
import { CSSProperties } from 'react';

interface Props {
	count: number;
	viewTransitionName?: string;
}

export default function HanabiDeck({ count, viewTransitionName }: Props): JSX.Element {
	const layers = Math.min(3, Math.max(0, count));

	return (
		<span
			aria-hidden="true"
			className="hanabi-status-deck-icon"
			data-status-icon="deck"
			data-deck-empty={layers === 0 ? true : undefined}
		>
			{Array.from({ length: layers }, (_, index) => {
				const depth = layers - index - 1;
				return (
					<span
						key={depth}
						className="hanabi-status-deck-card hanabi-player-tile"
						data-deck-depth={depth}
						style={{ '--hanabi-deck-depth': depth } as CSSProperties}
					>
						<HanabiTileView
							dimensions={HANABI_DESKTOP_TILE_SIZE}
							viewTransitionName={depth === 0 ? viewTransitionName : undefined}
						/>
					</span>
				);
			})}
		</span>
	);
}
