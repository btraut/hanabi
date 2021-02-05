import HanabiNewGamePopup from 'app/src/games/hanabi/client/HanabiNewGamePopup';
import Hamburger from 'app/src/games/hanabi/client/icons/Hamburger';
import { useState } from 'react';

export default function HanabiHeader(): JSX.Element {
	const [showNewGamePopup, setShowNewGamePopup] = useState(false);

	return (
		<div className="bg-black">
			<div className="mx-auto max-w-screen-xl px-4 flex justify-between items-center">
				<h1 className="text-white italic font-bold text-3xl px-3 py-2">Hanabi</h1>
				<button
					className="text-white p-3"
					onClick={() => {
						setShowNewGamePopup(true);
					}}
				>
					<Hamburger size={20} color="white" />
				</button>
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
