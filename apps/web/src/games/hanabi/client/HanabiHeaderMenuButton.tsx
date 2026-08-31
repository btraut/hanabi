import HanabiGameMenu from '~/games/hanabi/client/HanabiGameMenu';
import HanabiHamburgerButton from '~/games/hanabi/client/HanabiHamburgerButton';
import { useState } from 'react';

export default function HanabiHeaderMenuButton({
	variant = 'default',
}: {
	variant?: 'default' | 'game';
}): JSX.Element {
	const [showGameMenu, setShowGameMenu] = useState(false);

	return (
		<>
			<HanabiHamburgerButton
				expanded={showGameMenu}
				variant={variant}
				onClick={() => {
					setShowGameMenu(true);
				}}
			/>
			{showGameMenu && (
				<HanabiGameMenu
					onClose={() => {
						setShowGameMenu(false);
					}}
				/>
			)}
		</>
	);
}
