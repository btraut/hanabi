import { HanabiPlayer } from 'app/src/games/hanabi/HanabiGameData';
import Avatar from 'boring-avatars';
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
			<div className="border-3 border-black rounded-full">
				<Avatar
					size={size === 'lg' ? 102 : 36}
					name={player.name}
					variant="beam"
					colors={['#f43f5d', '#3b83f6', '#10b981', '#f59f0b', '#8a5cf6']}
				/>
			</div>
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
