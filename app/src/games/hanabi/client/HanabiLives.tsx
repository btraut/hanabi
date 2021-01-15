import HanabiLife from 'app/src/games/hanabi/client/HanabiLife';

interface Props {
	lives: number;
	maxLives: number;
}

export default function HanabiLives({ lives, maxLives }: Props): JSX.Element {
	return (
		<div className="grid grid-flow-col justify-start gap-x-1">
			{new Array(maxLives).fill('').map((_, index) => (
				<HanabiLife key={`clue-${index}`} placeholder={index >= lives} />
			))}
		</div>
	);
}
