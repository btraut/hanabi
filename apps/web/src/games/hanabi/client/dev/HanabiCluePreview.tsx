import {
	HANABI_CLUE_COLORS,
	HanabiGameAction,
	HanabiGameActionType,
	HanabiTileNumber,
} from '@hanabi/shared';
import { useState } from 'react';
import HanabiTileView from '../HanabiTileView';
import { getHanabiRecentTileClue, HanabiTileClue } from '../HanabiRecentClue';

const numbers: readonly HanabiTileNumber[] = [1, 2, 3, 4, 5];
const previewSize = { width: 78, height: 100 };
const handSize = { width: 50, height: 64 };
const matches = [
	{ id: 'card-1', color: 'red', number: 2 },
	{ id: 'card-3', color: 'rainbow', number: 2 },
] as const;

function clueAction(clue: HanabiTileClue): HanabiGameAction {
	return {
		id: 'preview-clue',
		type:
			clue.type === 'color'
				? HanabiGameActionType.GiveColorClue
				: HanabiGameActionType.GiveNumberClue,
		playerId: 'teammate',
		recipientId: 'you',
		tiles: [...matches],
		...(clue.type === 'color' ? { color: clue.value } : { number: clue.value }),
	};
}

export default function HanabiCluePreview(): JSX.Element {
	const [clue, setClue] = useState<HanabiTileClue>({ type: 'color', value: 'red' });
	const [nextTurnFinished, setNextTurnFinished] = useState(false);
	const actions: HanabiGameAction[] = [clueAction(clue)];
	if (nextTurnFinished) {
		actions.push({
			id: 'next-turn',
			type: HanabiGameActionType.Discard,
			playerId: 'you',
			tile: { id: 'other-card', color: 'blue', number: 1 },
		});
	}
	const selectClue = (selected: HanabiTileClue) => {
		setClue(selected);
		setNextTurnFinished(false);
	};
	const renderSample = (sample: HanabiTileClue) => (
		<button
			key={`${sample.type}-${sample.value}`}
			type="button"
			aria-label={`Give ${sample.value} clue`}
			className="hanabi-focus-ring flex flex-col items-center gap-3 rounded-lg px-3 py-4"
			onClick={() => selectClue(sample)}
		>
			<HanabiTileView
				dimensions={previewSize}
				recentClue={sample}
				highlight
				highlightTone={sample.type === 'color' ? sample.value : 'number'}
			/>
			<span className="text-lg capitalize text-hanabi-text">{sample.value}</span>
		</button>
	);

	return (
		<main className="hanabi-game-surface min-h-screen px-5 py-8 text-hanabi-text">
			<div className="mx-auto max-w-[840px]">
				<p className="text-sm uppercase tracking-[0.18em] text-hanabi-coral-soft">
					Hanabi · Clue preview
				</p>
				<h1 className="mt-2 text-4xl font-semibold">Clues, on the cards</h1>
				<p className="mt-3 text-lg text-hanabi-text-muted">
					A color wash or a number, visible until the following turn ends.
				</p>
				<section
					aria-label="Try a clue"
					className="my-7 rounded-xl border border-hanabi-border bg-hanabi-table-deep/70 p-5"
				>
					<div className="flex flex-wrap items-center justify-between gap-4">
						<div>
							<h2 className="text-xl font-semibold">Your hand</h2>
							<p aria-live="polite" className="mt-1 text-hanabi-text-muted">
								{nextTurnFinished
									? 'Next turn finished · clue cleared'
									: `${clue.value.toString().toUpperCase()} clue · two matching cards`}
							</p>
						</div>
						<button
							className="hanabi-focus-ring rounded-lg border border-hanabi-border px-4 py-2 disabled:opacity-40"
							type="button"
							disabled={nextTurnFinished}
							onClick={() => setNextTurnFinished(true)}
						>
							Finish next turn
						</button>
					</div>
					<div className="mt-5 flex gap-3 py-2" aria-label="Clue recipient's cards">
						{[0, 1, 2, 3, 4].map((index) => {
							const recentClue = getHanabiRecentTileClue(actions, 'you', `card-${index}`);
							return (
								<HanabiTileView
									key={index}
									dimensions={handSize}
									recentClue={recentClue}
									highlight={!!recentClue}
									highlightTone={clue.type === 'color' ? clue.value : 'number'}
									notesIndicator={index === 3}
								/>
							);
						})}
					</div>
					<p className="mt-3 text-sm text-hanabi-text-muted">
						Choose any clue below to try it. The folded corner marks stored notes.
					</p>
				</section>
				<section aria-labelledby="color-clues">
					<h2 id="color-clues" className="text-xl font-semibold">
						Color clues
					</h2>
					<div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
						{HANABI_CLUE_COLORS.map((value) => renderSample({ type: 'color', value }))}
					</div>
				</section>
				<section aria-labelledby="number-clues" className="mt-5">
					<h2 id="number-clues" className="text-xl font-semibold">
						Number clues
					</h2>
					<div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
						{numbers.map((value) => renderSample({ type: 'number', value }))}
					</div>
				</section>
			</div>
		</main>
	);
}
