import HanabiDropdown from 'app/src/games/hanabi/client/design-system/HanabiDropdown';
import { useGameMessenger } from 'app/src/games/hanabi/client/HanabiContext';
import { HanabiRuleSet } from 'app/src/games/hanabi/HanabiGameData';
import { ChangeEvent, useCallback, useEffect, useState } from 'react';

interface Props {
	ruleSet: HanabiRuleSet;
}

const OPTIONS: { [label: string]: HanabiRuleSet } = {
	'Basic 5-Color': '5-color',
	'Basic 6-Color': '6-color',
	'Decoy Rainbow': 'rainbow',
};

export default function HanabiChooseRuleSetForm({ ruleSet }: Props): JSX.Element {
	const gameMessenger = useGameMessenger();

	const [displayedRuleSet, setDisplayedRuleSet] = useState(ruleSet);

	// Build a handler for the dropdown. This will set the local dropdown value
	// optimistically and also update the server.
	const handleRuleSetChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			const newRuleSet = event.target.value as HanabiRuleSet;
			setDisplayedRuleSet(newRuleSet);

			gameMessenger.changeSettings({
				ruleSet: newRuleSet,
			});
		},
		[gameMessenger],
	);

	// If the server sends a different ruleSet, replace our local one.
	useEffect(() => {
		setDisplayedRuleSet(ruleSet);
	}, [ruleSet]);

	return (
		<HanabiDropdown
			id="choose-ruleset-dropdown"
			value={displayedRuleSet}
			options={OPTIONS}
			onChange={handleRuleSetChange}
		/>
	);
}
