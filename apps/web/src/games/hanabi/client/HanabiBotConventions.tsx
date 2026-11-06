import { HANABI_MAX_BOT_CONVENTIONS_BYTES, type HanabiBotStatus } from '@hanabi/shared';
import { useId, useRef, useState } from 'react';
import HanabiDialog from './design-system/HanabiDialog';
import HanabiMenuButton from './design-system/HanabiMenuButton';
import { useGameMessenger } from './HanabiGameContext';

type Conventions = NonNullable<HanabiBotStatus['conventions']>;

interface Props {
	conventions: Conventions;
	canEdit: boolean;
}

interface Draft {
	text: string;
	revision: number;
	baseText: string;
}

export default function HanabiBotConventions({ conventions, canEdit }: Props): JSX.Element {
	const messenger = useGameMessenger();
	const id = useId();
	const [open, setOpen] = useState(false);
	const [draft, setDraft] = useState<Draft | null>(null);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const inFlight = useRef(false);
	const busy = pending || conventions.reviewing;
	const text = canEdit && draft ? draft.text : conventions.text;
	const bytes = new TextEncoder().encode(text).length;
	const tooLong = bytes > HANABI_MAX_BOT_CONVENTIONS_BYTES;
	const conflict = canEdit && draft !== null && draft.revision !== conventions.revision;
	const dirty = draft !== null && draft.text !== draft.baseText;

	const loadSaved = () => {
		setDraft({
			text: conventions.text,
			revision: conventions.revision,
			baseText: conventions.text,
		});
		setError(null);
	};

	const save = async (value: string | null, revision: number) => {
		if (!canEdit || inFlight.current || conventions.reviewing) return;
		inFlight.current = true;
		setPending(true);
		setError(null);
		try {
			await messenger.changeBotConventions(value, revision);
			setDraft(null);
			setOpen(false);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Could not save bot conventions.');
		} finally {
			inFlight.current = false;
			setPending(false);
		}
	};

	return (
		<section className="hanabi-bot-conventions" aria-label="Bot conventions">
			<div className="hanabi-bot-conventions-row">
				<div>
					<div className="flex flex-wrap items-baseline gap-x-2">
						<h2 className="text-lg font-bold text-white">Bot conventions</h2>
						<span className="text-sm text-hanabi-text-muted">
							{conventions.custom ? 'Custom' : 'Default'}
						</span>
					</div>
					<p className="text-base text-hanabi-text-muted">
						Bots use these instructions to guide their actions.
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					{canEdit && conventions.custom && (
						<HanabiMenuButton
							label="Reset"
							disabled={busy}
							onClick={() => void save(null, conventions.revision)}
						/>
					)}
					<HanabiMenuButton
						label={canEdit ? 'Edit' : 'View'}
						disabled={pending}
						onClick={() => {
							if (!draft) loadSaved();
							setOpen(true);
						}}
					/>
				</div>
			</div>
			{busy && !open && (
				<p role="status" className="mt-2 text-base text-hanabi-text-muted">
					Checking conventions…
				</p>
			)}
			{error && !open && (
				<p role="alert" className="mt-2 text-base text-hanabi-coral-soft">
					{error}
				</p>
			)}
			{open && (
				<HanabiDialog
					title="Bot conventions"
					onClose={() => {
						if (!inFlight.current) setOpen(false);
					}}
				>
					<div className="hanabi-conventions-editor">
						<p className="text-base text-hanabi-text-muted">
							Bots use these instructions to guide their actions.
						</p>
						{conflict && (
							<div role="alert" className="hanabi-conventions-conflict">
								<p>The saved conventions changed. Your draft is preserved.</p>
								<div className="mt-2 flex flex-wrap gap-2">
									<HanabiMenuButton
										label="Load saved version"
										disabled={busy}
										onClick={loadSaved}
									/>
									<HanabiMenuButton
										label="Keep my draft"
										disabled={busy}
										onClick={() =>
											setDraft({ text, revision: conventions.revision, baseText: conventions.text })
										}
									/>
								</div>
							</div>
						)}
						{!canEdit ? (
							<pre className="hanabi-conventions-read" aria-label="Conventions text">
								{text}
							</pre>
						) : (
							<div>
								<label htmlFor={id} className="mb-2 block text-lg font-semibold">
									Instructions
								</label>
								<textarea
									id={id}
									className="hanabi-field hanabi-conventions-input"
									value={text}
									disabled={busy}
									spellCheck={false}
									aria-invalid={tooLong || undefined}
									aria-describedby={tooLong ? `${id}-limit` : undefined}
									onChange={(event) => {
										const value = event.target.value;
										setDraft((current) =>
											current
												? { ...current, text: value }
												: {
														text: value,
														revision: conventions.revision,
														baseText: conventions.text,
													},
										);
										setError(null);
									}}
								/>
							</div>
						)}
						{canEdit && tooLong && (
							<p id={`${id}-limit`} className="text-base text-hanabi-coral-soft">
								Shorten these instructions before saving.
							</p>
						)}
						{error && (
							<p role="alert" className="text-base text-hanabi-coral-soft">
								{error}
							</p>
						)}
						{busy && (
							<p role="status" className="text-base text-hanabi-text-muted">
								Checking conventions…
							</p>
						)}
						<div className="hanabi-conventions-actions">
							{canEdit && text !== conventions.defaultText && (
								<HanabiMenuButton
									label="Reset"
									disabled={busy}
									className="mr-auto"
									onClick={() => {
										setDraft((current) =>
											current
												? { ...current, text: conventions.defaultText }
												: {
														text: conventions.defaultText,
														revision: conventions.revision,
														baseText: conventions.text,
													},
										);
										setError(null);
									}}
								/>
							)}
							<HanabiMenuButton
								label={canEdit ? 'Cancel' : 'Close'}
								disabled={pending}
								onClick={() => {
									setDraft(null);
									setError(null);
									setOpen(false);
								}}
							/>
							{canEdit && (
								<HanabiMenuButton
									label={pending ? 'Checking…' : 'Save'}
									variant="primary"
									disabled={busy || conflict || !dirty || !text.trim() || tooLong}
									onClick={() => {
										if (draft)
											void save(text === conventions.defaultText ? null : text, draft.revision);
									}}
								/>
							)}
						</div>
					</div>
				</HanabiDialog>
			)}
		</section>
	);
}
