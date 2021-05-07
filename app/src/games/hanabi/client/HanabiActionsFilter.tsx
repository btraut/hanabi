import { ActionsFilterOption } from 'app/src/games/hanabi/HanabiGameData';
import classNames from 'classnames';
import { ChangeEvent, useCallback } from 'react';

type Props = {
	filter: ActionsFilterOption;
	onChange: (filter: ActionsFilterOption) => void;
};

const FILTER_OPTIONS: { [key: string]: string } = {
	all: 'All',
	clues: 'Clues',
	'to-me': 'To Me',
	'from-me': 'From Me',
	chat: 'Chat',
};

export default function HanabiActionsFilter({ filter, onChange }: Props): JSX.Element {
	const handleChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			onChange(event.target.value as ActionsFilterOption);
		},
		[onChange],
	);

	return (
		<div className="grid grid-flow-col gap-1 justify-start items-center p-2">
			{Object.keys(FILTER_OPTIONS).map((filterKey) => (
				<label
					key={filterKey}
					className={classNames('cursor-pointer px-2 py-0.5 text-sm rounded-xl select-none', {
						'bg-gray-600': filter === filterKey,
						'text-white': filter === filterKey,
						'hover:bg-gray-200': filter !== filterKey,
					})}
				>
					{FILTER_OPTIONS[filterKey]}
					<input
						className="hidden"
						type="radio"
						name="actions-filter"
						value={filterKey}
						onChange={handleChange}
						checked={filter === filterKey}
					/>
				</label>
			))}
		</div>
	);
}
