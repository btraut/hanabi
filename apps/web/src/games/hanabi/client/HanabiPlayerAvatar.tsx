import { HanabiPlayer } from '@hanabi/shared';
import Avatar from 'boring-avatars';
import classNames from 'classnames';
import X from '~/games/hanabi/client/icons/X';

interface Props {
	player: HanabiPlayer;
	size?: 'lg' | 'sm';
	color?: 'white' | 'yellow';
	showName?: boolean;
	onRemove?: () => void;
	removeDisabled?: boolean;
	thinking?: boolean;
}

export default function HanabiPlayerAvatar({
	player,
	size = 'lg',
	color = 'white',
	showName = true,
	onRemove,
	removeDisabled = false,
	thinking = false,
}: Props): JSX.Element {
	return (
		<div
			className={classNames(
				'grid grid-flow-row justify-center justify-items-center content-center items-center gap-y-2',
				{
					'opacity-60': player.kind !== 'bot' && !player.connected,
				},
			)}
			key={player.id}
		>
			<div className="relative">
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
				{thinking && player.kind === 'bot' && (
					<span aria-hidden="true" className="hanabi-avatar-orbit" />
				)}
				{onRemove && (
					<button
						type="button"
						aria-label={`Remove ${player.name}`}
						title={`Remove ${player.name}`}
						className="hanabi-focus-ring absolute -top-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border border-hanabi-border-bright bg-hanabi-surface-raised text-hanabi-text shadow-md transition-colors hover:bg-hanabi-border disabled:cursor-not-allowed disabled:opacity-50"
						disabled={removeDisabled}
						onClick={onRemove}
					>
						<X color="currentColor" size={16} />
					</button>
				)}
			</div>
			{showName && (
				<p
					className="text-lg font-bold truncate text-center"
					style={{
						color,
					}}
				>
					{player.name}
					{player.kind === 'bot' && (
						<span className="ml-1.5 text-sm font-medium text-hanabi-text-muted">Bot</span>
					)}
				</p>
			)}
		</div>
	);
}
