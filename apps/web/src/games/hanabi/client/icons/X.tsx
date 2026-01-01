interface Props {
	color?: string;
	size?: number;
}

export default function X({ color = '#000000', size = 40 }: Props): JSX.Element {
	return (
		<svg width={size} height={size} viewBox="0 0 559 559" version="1.1">
			<g stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
				<path
					d="M4,61 C23,42 42,23 61,4 C66,-1 74,-1 80,4 C146,71 213,137 279,204 C346,137 412,71 479,4 C484,-1 493,-1 498,4 C517,23 536,42 554,61 C560,66 560,74 554,80 C488,146 421,213 355,279 C421,346 488,412 554,479 C560,484 560,493 554,498 C536,517 517,536 498,554 C493,560 484,560 479,554 C412,488 346,421 279,355 C213,421 146,488 80,554 C74,560 66,560 61,554 C42,536 23,517 4,498 C-1,493 -1,484 4,479 C71,412 137,346 204,279 C137,213 71,146 4,80 C-1,74 -1,66 4,61 Z"
					fill={color}
				></path>
			</g>
		</svg>
	);
}
