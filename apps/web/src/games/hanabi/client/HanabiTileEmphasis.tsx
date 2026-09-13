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
	const outline = `M8 .5 H${width - 8} Q${right} .5 ${right} 8 ${corner} H8 Q.5 ${bottom} .5 ${height - 8} V8 Q.5 .5 8 .5 Z`;

	return (
		<span aria-hidden="true" className="hanabi-tile-emphasis-mark">
			{['outline', 'glow', 'separator'].map((layer) => (
				<svg
					key={layer}
					className={`hanabi-tile-emphasis-${layer}`}
					focusable="false"
					viewBox={`0 0 ${width} ${height}`}
				>
					<path
						d={outline}
						fill="none"
						stroke={layer === 'separator' ? '#07111f' : 'currentColor'}
						strokeWidth={layer === 'separator' ? 1.5 : 3}
						transform={
							layer === 'separator'
								? `translate(2 2) scale(${(width - 4) / width} ${(height - 4) / height})`
								: undefined
						}
						vectorEffect="non-scaling-stroke"
						strokeLinejoin="round"
					/>
				</svg>
			))}
		</span>
	);
}
