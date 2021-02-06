import HanabiHamburgerButton from 'app/src/games/hanabi/client/HanabiHamburgerButton';
import HanabiNewGamePopup from 'app/src/games/hanabi/client/HanabiNewGamePopup';
import { useState } from 'react';

export default function HanabiHeader(): JSX.Element {
	const [showNewGamePopup, setShowNewGamePopup] = useState(false);

	return (
		<div className="bg-black">
			<div className="mx-auto max-w-screen-xl px-4 flex justify-between items-center">
				<h1 className="text-white italic font-bold text-3xl px-3 py-2">Hanabi</h1>
				<HanabiHamburgerButton
					onClick={() => {
						setShowNewGamePopup(true);
					}}
				/>
				{showNewGamePopup && (
					<HanabiNewGamePopup
						onClose={() => {
							setShowNewGamePopup(false);
						}}
					/>
				)}
			</div>
		</div>
	);
}
