import Clock from 'app/src/games/hanabi/client/icons/clock';
import classnames from 'classnames';

interface Props {
	placeholder?: boolean;
}

export default function HanabiClue({ placeholder = false }: Props): JSX.Element {
	return (
		<div
			className={classnames([
				'bg-blue-900 rounded-full flex items-center justify-center w-12 h-12',
				{
					'opacity-20': placeholder,
				},
			])}
		>
			<Clock color="rgb(252, 211, 77)" size={30} />
		</div>
	);
}
