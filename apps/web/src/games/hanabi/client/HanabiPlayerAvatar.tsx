import { HanabiPlayer } from '@hanabi/shared';
import Avatar from 'boring-avatars';
import classNames from 'classnames';

interface Props {
	player: HanabiPlayer;
	size?: 'lg' | 'sm';
	color?: 'white' | 'yellow';
	showName?: boolean;
}

export default function HanabiPlayerAvatar({
	player,
	size = 'lg',
	color = 'white',
	showName = true,
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
			<div
				className={classNames('overflow-hidden rounded-full', {
					'border-3 border-black': size === 'lg',
					'border border-white/25 shadow-[inset_0_1px_8px_rgb(255_255_255_/_14%),0_2px_10px_rgb(0_0_0_/_35%)]':
						size === 'sm',
				})}
				data-hanabi-player-avatar={player.id}
			>
				<Avatar
					size={size === 'lg' ? 102 : 36}
					name={player.name}
					variant="beam"
					colors={['#f43f5d', '#3b83f6', '#10b981', '#f59f0b', '#8a5cf6']}
				/>
			</div>
			{showName && (
				<p
					className="text-lg font-bold truncate text-center"
					style={{
						color,
					}}
				>
					{player.name}
				</p>
			)}
		</div>
	);
}
