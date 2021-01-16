interface Props {
	color?: string;
	size?: number;
}

export default function User({ color = '#000000', size = 102 }: Props): JSX.Element {
	return (
		<svg width={size} height={Math.floor((size * 94) / 102)} viewBox="0 0 102 94" version="1.1">
			<g stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
				<g fill={color} fillRule="nonzero">
					<path d="M51.042,0.223 C23.2,0.223 0.63,22.793 0.63,50.634 C0.63,68.927 10.374,84.943 24.955,93.778 L24.955,82.058 C24.955,71.737 34.323,62.818 42.517,58.588 C36.291,54.933 32.017,47.403 32.017,38.702 C32.017,26.417 40.535,16.458 51.042,16.458 C61.549,16.458 70.067,26.417 70.067,38.702 C70.067,47.386 65.809,54.901 59.604,58.565 C67.821,62.787 77.127,71.719 77.127,82.057 L77.127,93.777 C91.707,84.942 101.451,68.925 101.451,50.633 C101.452,22.793 78.881,0.223 51.042,0.223 Z"></path>
				</g>
			</g>
		</svg>
	);
}
