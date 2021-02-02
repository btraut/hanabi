import Hamburger from 'app/src/games/hanabi/client/icons/Hamburger';

export default function HanabiHeader(): JSX.Element {
	return (
		<div className="bg-black">
			<div className="mx-auto max-w-screen-xl px-4 flex justify-between items-center">
				<h1 className="text-white italic font-bold text-3xl px-3 py-2">Hanabi</h1>
				<button className="text-white p-3">
					<Hamburger size={20} color="white" />
				</button>
			</div>
		</div>
	);
}
