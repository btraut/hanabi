import HanabiCheckbox from 'app/src/games/hanabi/client/design-system/HanabiCheckbox';
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
		<HanabiPopup background="gray" onClose={onClose} backgroundWash>
			<div style={{ width: 320 }}>
				<h1 className="italic text-4xl text-white font-normal text-center mb-8">Options</h1>
				<div className="grid grid-flow-col gap-x-2 justify-center items-center mb-8">
					<div className="grid grid-flow-col gap-3 justify-start items-center">
						<HanabiCheckbox
							id="play-sounds"
							checked={playSounds}
							onChange={(event: ChangeEvent<HTMLInputElement>) => {
								setPlaySounds(event.target.checked);
							}}
						/>
						<label
							htmlFor="play-sounds"
							className="text-lg font-bold truncate text-center text-white cursor-pointer select-none"
						>
							Play Sounds
						</label>
					</div>
				</div>
				<div className="grid grid-flow-col gap-x-4 justify-center">
					<HanabiMenuButton label="Close" onClick={onClose} />
				</div>
			</div>
		</HanabiPopup>
	);
}
