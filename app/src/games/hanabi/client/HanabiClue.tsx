import Clock from 'app/src/games/hanabi/client/icons/clock';
import classnames from 'classnames';

interface Props {
	size?: number;
	placeholder?: boolean;
	hideIcon?: boolean;
}

export default function HanabiClue({
	placeholder = false,
	size = 48,
	hideIcon = false,
}: Props): JSX.Element {
	return (
		<div
			className={classnames([
				'rounded-full flex items-center justify-center shadow-light',
				{
					'bg-blue-900': !placeholder,
					'bg-gray-300': placeholder,
				},
			])}
			style={{ width: size, height: size }}
		>
			{!hideIcon && <Clock color="rgb(252, 211, 77)" size={Math.floor((5 * size) / 8)} />}
		</div>
	);
}
