import HanabiGameMenu from 'app/src/games/hanabi/client/HanabiGameMenu';
import HanabiHamburgerButton from 'app/src/games/hanabi/client/HanabiHamburgerButton';
import HanabiOptionsMenu from 'app/src/games/hanabi/client/HanabiOptionsMenu';
import { useState } from 'react';

export default function HanabiHeaderMenuButton(): JSX.Element {
	const [showGameMenu, setShowGameMenu] = useState(false);
	const [showOptionsMenu, setShowOptionsMenu] = useState(false);

	return (
		<>
			<HanabiHamburgerButton
				onClick={() => {
					setShowGameMenu(true);
				}}
			/>
			{showGameMenu && (
				<HanabiGameMenu
					onClose={() => {
						setShowGameMenu(false);
					}}
					onOptions={() => {
						setShowGameMenu(false);
						setShowOptionsMenu(true);
					}}
				/>
			)}
			{showOptionsMenu && (
				<HanabiOptionsMenu
					onClose={() => {
						setShowOptionsMenu(false);
					}}
				/>
			)}
		</>
	);
}
