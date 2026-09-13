import { HanabiGameData, HanabiStage, isHanabiRuleSet } from '@hanabi/shared';
import { useEffect } from 'react';
import LOCAL_STORAGE_KEYS from './HanabiLocalStorageManager';

export type HanabiLobbySettings = Pick<
	HanabiGameData,
	'ruleSet' | 'criticalGameOver' | 'allowDragging' | 'showNotes'
>;

export function readHanabiLobbySettings(): HanabiLobbySettings | undefined {
	try {
		const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.LOBBY_SETTINGS);
		if (!stored) return undefined;
		const value: unknown = JSON.parse(stored);
		if (typeof value !== 'object' || value === null) return undefined;
		const settings = value as Record<string, unknown>;
		if (
			!isHanabiRuleSet(settings.ruleSet) ||
			typeof settings.criticalGameOver !== 'boolean' ||
			typeof settings.allowDragging !== 'boolean' ||
			typeof settings.showNotes !== 'boolean'
		) {
			return undefined;
		}
		return {
			ruleSet: settings.ruleSet,
			criticalGameOver: settings.criticalGameOver,
			allowDragging: settings.allowDragging,
			showNotes: settings.showNotes,
		};
	} catch {
		return undefined;
	}
}

export function useRememberHanabiLobbySettings(game: HanabiGameData, joined: boolean): void {
	const { ruleSet, criticalGameOver, allowDragging, showNotes, stage } = game;
	useEffect(() => {
		if (!joined || stage !== HanabiStage.Setup) return;
		try {
			localStorage.setItem(
				LOCAL_STORAGE_KEYS.LOBBY_SETTINGS,
				JSON.stringify({ ruleSet, criticalGameOver, allowDragging, showNotes }),
			);
		} catch {
			// The shared lobby remains usable when browser storage is unavailable.
		}
	}, [joined, stage, ruleSet, criticalGameOver, allowDragging, showNotes]);
}
