import HanabiLife from 'app/src/games/hanabi/client/HanabiLife';
import classnames from 'classnames';

interface Props {
	lives: number;
	maxLives: number;
	direction?: 'row' | 'col';
}

export default function HanabiLives({ lives, maxLives, direction = 'row' }: Props): JSX.Element {
	return (
		<div
			className={classnames('grid justify-start gap-1', {
				'grid-flow-col': direction === 'row',
				'grid-flow-row': direction === 'col',
			})}
		>
			{new Array(maxLives).fill('').map((_, index) => (
				<HanabiLife key={`clue-${index}`} placeholder={index >= lives} />
			))}
		</div>
	);
}
