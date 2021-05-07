import MagnifyingGlass from 'app/src/games/hanabi/client/icons/MagnifyingGlass';

const CLUE_SIZE = 32;

type Props = {
	index?: number;
	animateBackground?: boolean;
};

export default function HanabiClue({ animateBackground, index }: Props): JSX.Element {
	return (
		<div
			className="rounded-full flex items-center justify-center shadow-light bg-blue-900"
			style={{
				width: CLUE_SIZE,
				height: CLUE_SIZE,
				animationName: animateBackground ? `bg-blue-to-red` : '',
				animationDelay: `${(index ?? 0) * 0.1}s`,
				animationDuration: '1.5s',
				animationIterationCount: 'infinite',
			}}
		>
			<MagnifyingGlass color="white" size={Math.floor((CLUE_SIZE * 9) / 16)} />
		</div>
	);
}
