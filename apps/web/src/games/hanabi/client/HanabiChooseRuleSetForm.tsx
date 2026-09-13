import { useGameMessenger } from '~/games/hanabi/client/HanabiGameContext';
import HanabiTileView from '~/games/hanabi/client/HanabiTileView';
import { getHanabiRuleSetColors, HanabiRuleSet, HanabiTileNumber } from '@hanabi/shared';
import { ChangeEvent, useCallback, useEffect, useId, useState } from 'react';

interface Props {
	ruleSet: HanabiRuleSet;
}

const OPTIONS: Record<HanabiRuleSet, { title: string; description: string }> = {
	'5-color': {
		title: 'Basic 5-Color',
		description: 'Build five colored fireworks from 1 to 5.',
	},
	'6-color': {
		title: 'Basic 6-Color',
		description: 'Add a sixth suit that behaves just like the others.',
	},
	rainbow: {
		title: 'Decoy Rainbow',
		description: 'Add rainbow tiles that match every color clue.',
	},
	'black-powder': {
		title: 'Black Powder',
		description: 'Black tiles must be played from 5 to 1 and cannot be given color clues.',
	},
	'rainbow-black-powder': {
		title: 'Decoy Rainbow + Black Powder',
		description: 'Combine Decoy Rainbow and Black Powder rules.',
	},
};

const PREVIEW_NUMBERS: readonly HanabiTileNumber[] = [1, 2, 3, 4, 5, 5, 5];

export default function HanabiChooseRuleSetForm({ ruleSet }: Props): JSX.Element {
	const gameMessenger = useGameMessenger();
	const id = useId();

	const [displayedRuleSet, setDisplayedRuleSet] = useState(ruleSet);

	// Select optimistically while the server broadcasts the shared settings.
	const handleRuleSetChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			const newRuleSet = event.target.value as HanabiRuleSet;
			setDisplayedRuleSet(newRuleSet);

			void gameMessenger
				.changeSettings({
					ruleSet: newRuleSet,
				})
				.catch((error: unknown) => {
					console.error('Could not change the rule set:', error);
				});
		},
		[gameMessenger],
	);

	// If the server sends a different ruleSet, replace our local one.
	useEffect(() => {
		setDisplayedRuleSet(ruleSet);
	}, [ruleSet]);

	return (
		<fieldset className="hanabi-rule-picker min-w-0">
			<legend className="mb-3 text-lg font-bold text-white">
				<label id={`${id}-label`} htmlFor={id}>
					Game Mode
				</label>
			</legend>
			<div className="hanabi-rule-control">
				<div className="hanabi-select-wrap">
					<select
						id={id}
						className="hanabi-field hanabi-select"
						value={displayedRuleSet}
						onChange={handleRuleSetChange}
						aria-labelledby={`${id}-label`}
						aria-describedby={`${id}-description`}
					>
						{Object.entries(OPTIONS).map(([value, option]) => (
							<option key={value} value={value}>
								{option.title}
							</option>
						))}
					</select>
					<span aria-hidden="true" className="hanabi-select-chevron" />
				</div>
				<label className="hanabi-rule-preview" htmlFor={id}>
					<div className="hanabi-rule-tiles" aria-hidden="true">
						{getHanabiRuleSetColors(displayedRuleSet).map((color, index) => (
							<HanabiTileView
								key={color}
								color={color}
								number={color === 'black' ? 5 : PREVIEW_NUMBERS[index]}
								dimensions={{ width: 36, height: 46 }}
							/>
						))}
					</div>
					<p id={`${id}-description`} aria-live="polite" className="hanabi-rule-description">
						{OPTIONS[displayedRuleSet].description}
					</p>
				</label>
			</div>
		</fieldset>
	);
}
