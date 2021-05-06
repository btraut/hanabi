import HanabiDropdown from 'app/src/games/hanabi/client/design-system/HanabiDropdown';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
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
	const game = useHanabiGame();

	const [displayedRuleSet, setDisplayedRuleSet] = useState(ruleSet);

	// Build a handler for the dropdown. This will set the local dropdown value
	// optimistically and also update the server.
	const handleRuleSetChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			const newRuleSet = event.target.value as HanabiRuleSet;
			setDisplayedRuleSet(newRuleSet);

			game.changeSettings({
				ruleSet: newRuleSet,
			});
		},
		[game],
	);

	// If the server sends a different ruleSet, replace our local one.
	useEffect(() => {
		setDisplayedRuleSet(ruleSet);
	}, [ruleSet]);

	return (
		<div className="grid grid-flow-col gap-3 justify-center items-center">
			<label className="text-lg font-bold truncate text-center text-white">Game Mode:</label>
			<HanabiDropdown value={displayedRuleSet} options={OPTIONS} onChange={handleRuleSetChange} />
		</div>
	);
}
