import 'app/sounds/hanabi/right.wav';
import 'app/sounds/hanabi/wrong.wav';
import 'app/sounds/hanabi/beep.wav';

import { useUserId } from 'app/src/components/SocketContext';
import useLatestActions from 'app/src/games/hanabi/client/useLatestActions';
import {
	HanabiGameActionDiscard,
	HanabiGameActionGiveClue,
	HanabiGameActionPlay,
	HanabiGameActionType,
} from 'app/src/games/hanabi/HanabiGameData';
import { useEffect, useRef } from 'react';

const PLAY_SOUNDS_FOR_ACTING_USER = true;

function playAudio(ele: HTMLAudioElement) {
	try {
		ele.play();
	} catch (error) {
		console.log('Cannot play audio clip: ', error);
	}
}

export default function useActionSounds(): void {
	const rightRef = useRef<HTMLAudioElement | null>();
	const wrongRef = useRef<HTMLAudioElement | null>();
	const beepRef = useRef<HTMLAudioElement | null>();

	if (!rightRef.current) {
		rightRef.current = new Audio('/sounds/hanabi/right.wav');
	}
	if (!wrongRef.current) {
		wrongRef.current = new Audio('/sounds/hanabi/wrong.wav');
	}
	if (!beepRef.current) {
		beepRef.current = new Audio('/sounds/hanabi/beep.wav');
	}

	const userId = useUserId();

	const latestActions = useLatestActions();
	const latestTileAction:
		| HanabiGameActionPlay
		| HanabiGameActionDiscard
		| HanabiGameActionGiveClue = latestActions
		.reverse()
		.find((a) =>
			[
				HanabiGameActionType.Play,
				HanabiGameActionType.Discard,
				HanabiGameActionType.GiveColorClue,
				HanabiGameActionType.GiveNumberClue,
			].includes(a.type),
		) as any;

	useEffect(() => {
		if (!latestTileAction) {
			return;
		}

		if (latestTileAction.type === HanabiGameActionType.Play) {
			if (latestTileAction.playerId !== userId || PLAY_SOUNDS_FOR_ACTING_USER) {
				if (latestTileAction.valid) {
					playAudio(rightRef.current!);
				} else {
					playAudio(wrongRef.current!);
				}
			}
		} else if (
			latestTileAction.type === HanabiGameActionType.Discard ||
			latestTileAction.type === HanabiGameActionType.GiveColorClue ||
			latestTileAction.type === HanabiGameActionType.GiveNumberClue
		) {
			if (latestTileAction.playerId !== userId || PLAY_SOUNDS_FOR_ACTING_USER) {
				playAudio(beepRef.current!);
			}
		}
	}, [latestTileAction, userId]);
}
