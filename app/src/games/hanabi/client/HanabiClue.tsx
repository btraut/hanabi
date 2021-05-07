import MagnifyingGlass from 'app/src/games/hanabi/client/icons/MagnifyingGlass';

const CLUE_SIZE = 32;

type Props = {
	index?: number;
	animateBackground?: boolean;
};

export default function HanabiClue({ animateBackground }: Props): JSX.Element {
	return (
		<div
			className="rounded-full flex items-center justify-center shadow-light bg-blue-900"
			style={{
				width: CLUE_SIZE,
				height: CLUE_SIZE,
				animation: animateBackground ? `bg-blue-to-red 1s infinite` : '',
			}}
		>
			<MagnifyingGlass color="white" size={Math.floor((CLUE_SIZE * 9) / 16)} />
		</div>
	);
}
