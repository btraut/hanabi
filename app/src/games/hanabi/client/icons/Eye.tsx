interface Props {
	color?: string;
	size?: number;
}

export default function Eye({ color = '#000000', size = 40 }: Props): JSX.Element {
	return (
		<svg width={size} height={Math.floor(size / 2)} viewBox="0 0 72 36" version="1.1">
			<g stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
				<g id="Group" fill={color} fillRule="nonzero">
					<path d="M36,35.8 C50.68,35.8 63.72,28.82 72,18 C63.72,7.18 50.68,0.2 36,0.2 C21.32,0.2 8.28,7.18 0,18 C8.28,28.82 21.32,35.8 36,35.8 Z M36,4 C43.73,4 50,10.27 50,18 C50,25.73 43.73,32 36,32 C28.27,32 22,25.73 22,18 C22,10.27 28.27,4 36,4 Z"></path>
					<path d="M36,28 C41.52,28 46,23.52 46,18 C46,12.48 41.52,8 36,8 C30.48,8 26,12.48 26,18 C26,23.52 30.48,28 36,28 Z M35,22.5 C38.03,22.5 40.5,20.03 40.5,17 C40.5,16.17 41.17,15.5 42,15.5 C42.83,15.5 43.5,16.17 43.5,17 C43.5,21.69 39.69,25.5 35,25.5 C34.17,25.5 33.5,24.83 33.5,24 C33.5,23.17 34.17,22.5 35,22.5 Z"></path>
				</g>
			</g>
		</svg>
	);
}
