import Heart from 'app/src/games/hanabi/client/icons/Heart';
import classnames from 'classnames';

interface Props {
	size?: number;
	placeholder?: boolean;
	hideIcon?: boolean;
}

export default function HanabiLife({
	placeholder = false,
	size = 48,
	hideIcon = false,
}: Props): JSX.Element {
	return (
		<div
			className={classnames([
				'rounded-full flex items-center justify-center shadow-light',
				{
					'bg-red-700': !placeholder,
					'bg-gray-300': placeholder,
				},
			])}
			style={{ width: size, height: size }}
		>
			{!hideIcon && <Heart color="white" size={Math.floor((5 * size) / 8)} />}
		</div>
	);
}
