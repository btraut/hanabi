import User from 'app/src/games/hanabi/client/icons/User';
import { HanabiPlayer } from 'app/src/games/hanabi/HanabiGameData';
import classNames from 'classnames';

interface Props {
	player: HanabiPlayer;
	size?: 'lg' | 'sm';
	color?: 'white' | 'yellow';
}

export default function HanabiPlayerAvatar({
	player,
	size = 'lg',
	color = 'white',
}: Props): JSX.Element {
	return (
		<div
			className={classNames(
				'grid grid-flow-row justify-center justify-items-center content-center items-center gap-y-2',
				{
					'opacity-60': !player.connected,
				},
			)}
			key={player.id}
		>
			<User color={color} size={size === 'lg' ? 102 : 48} />
			<p
				className="text-lg font-bold truncate text-center"
				style={{
					color,
				}}
			>
				{player.name}
			</p>
		</div>
	);
}
