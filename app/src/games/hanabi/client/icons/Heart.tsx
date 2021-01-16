interface Props {
	color?: string;
	size?: number;
}

export default function Heart({ color = '#000000', size = 40 }: Props): JSX.Element {
	return (
		<svg width={size} height={Math.floor((size * 82) / 90)} viewBox="0 0 90 82" version="1.1">
			<g stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
				<g transform="translate(-5.000000, 0.000000)" fill={color} fillRule="nonzero">
					<path d="M50,81.326 L47.919,79.965 C46.17,78.821 5.09,51.675 5.09,27.196 C5.09,9.784 17.463,0.675 29.685,0.675 C37.498,0.675 44.816,4.321 49.997,10.622 C55.161,4.332 62.49,0.675 70.316,0.675 C82.538,0.675 94.91,9.785 94.91,27.196 C94.91,51.675 53.83,78.821 52.082,79.965 L50,81.326 Z"></path>
				</g>
			</g>
		</svg>
	);
}
