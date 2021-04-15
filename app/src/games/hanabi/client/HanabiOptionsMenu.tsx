import HanabiMenuButton from 'app/src/games/hanabi/client/design-system/HanabiMenuButton';
import HanabiPopup from 'app/src/games/hanabi/client/design-system/HanabiPopup';
import { useHanabiOptionsContext } from 'app/src/games/hanabi/client/HanabiOptionsContext';
import { ChangeEvent } from 'react';

interface Props {
	onClose: () => void;
}

export default function HanabiOptionsMenu({ onClose }: Props): JSX.Element | null {
	const { playSounds, setPlaySounds } = useHanabiOptionsContext();

	return (
		<HanabiPopup background="gray" closeButton onClose={onClose} backgroundWash>
			<div style={{ width: 480 }}>
				<h1 className="italic text-4xl text-white font-normal text-center mb-8">Options</h1>
				<div className="grid grid-flow-col gap-x-2 justify-center items-center mb-8">
					<label className="text-lg font-bold truncate text-center text-white">Play Sounds:</label>
					<input
						type="checkbox"
						checked={playSounds}
						onChange={(event: ChangeEvent<HTMLInputElement>) => {
							setPlaySounds(event.target.checked);
						}}
					/>
				</div>
				<div className="grid grid-flow-col gap-x-4 justify-center">
					<HanabiMenuButton label="Close" onClick={onClose} />
				</div>
			</div>
		</HanabiPopup>
	);
}
