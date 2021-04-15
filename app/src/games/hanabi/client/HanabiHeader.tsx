import HanabiHeaderMenuButton from 'app/src/games/hanabi/client/HanabiHeaderMenuButton';

export default function HanabiHeader(): JSX.Element {
	return (
		<div className="bg-black">
			<div className="mx-auto max-w-screen-xl px-4 flex justify-between items-center">
				<h1 className="text-white italic font-bold text-3xl px-3 py-2">Hanabi</h1>
				<HanabiHeaderMenuButton />
			</div>
		</div>
	);
}
