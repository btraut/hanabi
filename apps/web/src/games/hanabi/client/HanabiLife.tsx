import Heart from '~/games/hanabi/client/icons/Heart';

const LIFE_SIZE = 32;

export default function HanabiLife(): JSX.Element {
	return (
		<div
			className="rounded-full flex items-center justify-center shadow-light bg-red-700"
			style={{ width: LIFE_SIZE, height: LIFE_SIZE }}
		>
			<Heart color="white" size={Math.floor(LIFE_SIZE / 2)} />
		</div>
	);
}
