export const HANABI_TILE_NOTE_FOLD_SIZE = 15;

export default function HanabiTileEmphasis({
	dimensions: { width, height },
	folded = false,
}: {
	dimensions: { width: number; height: number };
	folded?: boolean;
}): JSX.Element {
	const right = width - 0.5;
	const bottom = height - 0.5;
	// Match the outer return curve of the paper corner, leaving the space below it open.
	const corner = folded
		? `V${height - HANABI_TILE_NOTE_FOLD_SIZE} C${width - 2} ${height - 8.3} ${width - 8.3} ${height - 2} ${width - HANABI_TILE_NOTE_FOLD_SIZE} ${bottom}`
		: `V${height - 8} Q${right} ${bottom} ${width - 8} ${bottom}`;

	return (
		<svg
			aria-hidden="true"
			className="hanabi-tile-emphasis-mark"
			focusable="false"
			viewBox={`0 0 ${width} ${height}`}
		>
			<path
				d={`M8 .5 H${width - 8} Q${right} .5 ${right} 8 ${corner} H8 Q.5 ${bottom} .5 ${height - 8} V8 Q.5 .5 8 .5 Z`}
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinejoin="round"
			/>
		</svg>
	);
}
