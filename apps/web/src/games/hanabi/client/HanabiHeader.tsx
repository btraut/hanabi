import { useHanabiGameContext } from '~/games/hanabi/client/HanabiGameContext';
import HanabiHeaderMenuButton from '~/games/hanabi/client/HanabiHeaderMenuButton';
import HanabiCopyLinkButton from '~/games/hanabi/client/HanabiCopyLinkButton';
import { HANABI_BRAND_MARK_PATH } from '~/games/hanabi/client/HanabiArtwork';
import useFocusVisible from '~/utils/client/useFocusVisible';
import classNames from 'classnames';

interface Props {
	variant?: 'default' | 'game';
}

export default function HanabiHeader({ variant = 'default' }: Props): JSX.Element {
	const isFocusVisible = useFocusVisible();
	const { code } = useHanabiGameContext();

	if (variant === 'game') {
		return (
			<header className="border-b border-hanabi-border bg-hanabi-table-deep/90 backdrop-blur">
				<div className="mx-auto flex min-h-14 max-w-[1240px] items-center justify-between gap-6 px-5">
					<a className="hanabi-focus-ring group flex items-center gap-3 rounded-md" href="/">
						<img
							alt=""
							aria-hidden="true"
							className="size-8 drop-shadow-[0_0_9px_rgb(255_114_95_/_28%)]"
							src={HANABI_BRAND_MARK_PATH}
						/>
						<span className="text-xl font-semibold tracking-tight text-hanabi-text transition-colors group-hover:text-hanabi-coral-soft">
							Hanabi
						</span>
					</a>
					<div className="flex items-center gap-3">
						{code && <HanabiCopyLinkButton compact label="Game" link={code} />}
						<HanabiHeaderMenuButton />
					</div>
				</div>
			</header>
		);
	}

	return (
		<div className="bg-black">
			<div className="mx-auto max-w-screen-xl px-4 flex justify-between items-center">
				<h1 className="text-white italic font-bold text-3xl px-3 py-2">
					<a
						className={classNames('hover:text-red-600', {
							'focus:text-red-600': isFocusVisible,
						})}
						href="/"
					>
						Hanabi
					</a>
				</h1>
				<HanabiHeaderMenuButton />
			</div>
		</div>
	);
}
