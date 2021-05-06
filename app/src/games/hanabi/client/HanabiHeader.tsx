import HanabiHeaderMenuButton from 'app/src/games/hanabi/client/HanabiHeaderMenuButton';
import useFocusVisible from 'app/src/utils/client/useFocusVisible';
import classNames from 'classnames';

export default function HanabiHeader(): JSX.Element {
	const isFocusVisible = useFocusVisible();

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
