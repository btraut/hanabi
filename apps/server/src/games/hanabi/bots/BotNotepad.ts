import { HanabiStage } from '@hanabi/shared';
import type { BotHistory } from './BotHistory.js';

export const MAX_BOT_NOTE_LENGTH = 8_000;

export interface BotNotepadCheckpoint {
	eventId: string;
	sequence: number;
	turnIndex: number;
}

export interface BotNotepadEntry {
	decisionId: string;
	opportunity: 'turn' | 'clue' | 'result';
	observedAt: BotNotepadCheckpoint;
	recordedAt: BotNotepadCheckpoint;
	sourceClueEventIds: string[];
	sourceActionEventId?: string;
	explanation: string;
	notes: string | null;
}

/** A private per-seat decision ledger. Entries are model claims, never factual clue evidence. */
export interface BotNotepad {
	version: 1;
	entries: BotNotepadEntry[];
}

export type BotNotepads = Record<string, BotNotepad>;

export function getBotNotepadCheckpoint(history: BotHistory): BotNotepadCheckpoint {
	if (history.version === 2) {
		const event = history.events.at(-1);
		if (event)
			return { eventId: event.eventId, sequence: event.sequence, turnIndex: event.turnIndex };
	} else {
		const move = history.moves.at(-1);
		if (move)
			return {
				eventId: move.actionId,
				sequence: history.moves.length,
				turnIndex: history.moves.length,
			};
	}
	return { eventId: 'initial', sequence: 0, turnIndex: 0 };
}

function record(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown, maximum: number): value is string {
	return typeof value === 'string' && value.trim().length > 0 && value.length <= maximum;
}

function onlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
	return Object.keys(value).every((key) => keys.includes(key));
}

function checkpoint(value: unknown): value is BotNotepadCheckpoint {
	return (
		record(value) &&
		onlyKeys(value, ['eventId', 'sequence', 'turnIndex']) &&
		text(value.eventId, 256) &&
		typeof value.sequence === 'number' &&
		Number.isSafeInteger(value.sequence) &&
		value.sequence >= 0 &&
		typeof value.turnIndex === 'number' &&
		Number.isSafeInteger(value.turnIndex) &&
		value.turnIndex >= 0 &&
		value.turnIndex <= value.sequence
	);
}

function entry(value: unknown): value is BotNotepadEntry {
	return (
		record(value) &&
		onlyKeys(value, [
			'decisionId',
			'opportunity',
			'observedAt',
			'recordedAt',
			'sourceClueEventIds',
			'sourceActionEventId',
			'explanation',
			'notes',
		]) &&
		text(value.decisionId, 256) &&
		(value.opportunity === 'turn' ||
			value.opportunity === 'clue' ||
			value.opportunity === 'result') &&
		(value.opportunity === 'result'
			? text(value.sourceActionEventId, 256)
			: value.sourceActionEventId === undefined) &&
		checkpoint(value.observedAt) &&
		checkpoint(value.recordedAt) &&
		Array.isArray(value.sourceClueEventIds) &&
		value.sourceClueEventIds.every((id) => text(id, 256)) &&
		new Set(value.sourceClueEventIds).size === value.sourceClueEventIds.length &&
		(value.opportunity !== 'result' || value.sourceClueEventIds.length === 0) &&
		text(value.explanation, 1_000) &&
		(value.notes === null || text(value.notes, MAX_BOT_NOTE_LENGTH))
	);
}

/** Validate structure without truncating old entries or imposing a round-wide entry limit. */
export function isBotNotepads(value: unknown): value is BotNotepads {
	return (
		record(value) &&
		Object.values(value).every(
			(notepad) =>
				record(notepad) &&
				onlyKeys(notepad, ['version', 'entries']) &&
				notepad.version === 1 &&
				Array.isArray(notepad.entries) &&
				notepad.entries.every(entry),
		)
	);
}

/** Verify ownership and historical provenance before restoring private notes into a request. */
export function botNotepadsMatchHistory(
	notepads: BotNotepads,
	history: BotHistory,
	botIds: readonly string[],
): boolean {
	if (!isBotNotepads(notepads) || history.version !== 2) return false;
	const owners = new Set(botIds);
	const events = new Map(history.events.map((event) => [event.eventId, event]));
	const currentPlayers = [history.initialState.currentPlayerId];
	const stages = [history.initialState.stage];
	for (const event of history.events) {
		currentPlayers.push(
			event.type === 'arrangement' ? currentPlayers.at(-1)! : event.postTurn.currentPlayerId,
		);
		stages.push(event.type === 'arrangement' ? stages.at(-1)! : event.postTurn.stage);
	}
	const matchesCheckpoint = (point: BotNotepadCheckpoint): boolean => {
		if (point.eventId === 'initial') return point.sequence === 0 && point.turnIndex === 0;
		const event = events.get(point.eventId);
		return (
			event !== undefined &&
			event.sequence === point.sequence &&
			event.turnIndex === point.turnIndex
		);
	};
	const decisionIds = new Set<string>();
	for (const [ownerId, notepad] of Object.entries(notepads)) {
		if (!owners.has(ownerId)) return false;
		let previousRecordedSequence = 0;
		const reflectedActionIds = new Set<string>();
		for (const item of notepad.entries) {
			if (
				decisionIds.has(item.decisionId) ||
				!matchesCheckpoint(item.observedAt) ||
				!matchesCheckpoint(item.recordedAt) ||
				item.observedAt.sequence < previousRecordedSequence ||
				item.recordedAt.sequence < item.observedAt.sequence ||
				(item.opportunity === 'clue' && item.sourceClueEventIds.length === 0)
			)
				return false;
			if (item.opportunity !== 'result' && stages[item.observedAt.sequence] !== HanabiStage.Playing)
				return false;
			if (item.opportunity === 'result') {
				const source = events.get(item.sourceActionEventId!);
				if (
					!source ||
					(source.type !== 'play' && source.type !== 'discard') ||
					source.actorId !== ownerId ||
					source.sequence > item.observedAt.sequence ||
					reflectedActionIds.has(source.eventId) ||
					history.events
						.slice(source.sequence, item.observedAt.sequence)
						.some((event) => event.actorId === ownerId && event.type !== 'arrangement')
				)
					return false;
				reflectedActionIds.add(source.eventId);
			}
			const committed = history.events.slice(item.observedAt.sequence, item.recordedAt.sequence);
			if (item.opportunity === 'turn') {
				const action = committed.at(-1);
				if (
					currentPlayers[item.observedAt.sequence] !== ownerId ||
					item.recordedAt.turnIndex !== item.observedAt.turnIndex + 1 ||
					(committed.length !== 1 && committed.length !== 2) ||
					!action ||
					action.type === 'arrangement' ||
					action.actorId !== ownerId ||
					(committed.length === 2 &&
						(committed[0].type !== 'arrangement' || committed[0].actorId !== ownerId))
				)
					return false;
			} else if (item.opportunity === 'result') {
				const ownEvents = committed.filter((event) => event.actorId === ownerId);
				if (
					(stages[item.observedAt.sequence] !== HanabiStage.Playing && committed.length !== 0) ||
					ownEvents.length > 1 ||
					ownEvents.some(
						(event) =>
							event.type !== 'arrangement' || stages[event.sequence - 1] !== HanabiStage.Playing,
					)
				)
					return false;
			} else if (
				(item.opportunity === 'clue' && currentPlayers[item.observedAt.sequence] === ownerId) ||
				(stages[item.observedAt.sequence] !== HanabiStage.Playing && committed.length !== 0) ||
				item.recordedAt.turnIndex !== item.observedAt.turnIndex ||
				committed.length > 1 ||
				(committed.length === 1 &&
					(committed[0].type !== 'arrangement' || committed[0].actorId !== ownerId))
			)
				return false;
			for (const clueId of item.sourceClueEventIds) {
				const source = events.get(clueId);
				if (
					source?.type !== 'clue' ||
					source.recipientId !== ownerId ||
					source.sequence > item.observedAt.sequence ||
					reflectedActionIds.has(source.eventId) ||
					history.events
						.slice(source.sequence, item.observedAt.sequence)
						.some((event) => event.actorId === ownerId && event.type !== 'arrangement')
				)
					return false;
			}
			decisionIds.add(item.decisionId);
			previousRecordedSequence = item.recordedAt.sequence;
		}
	}
	return true;
}
