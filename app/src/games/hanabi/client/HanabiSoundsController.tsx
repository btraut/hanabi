import 'app/sounds/hanabi/right.wav';
import 'app/sounds/hanabi/wrong.wav';
import 'app/sounds/hanabi/beep.wav';

import { useUserId } from 'app/src/components/SocketContext';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import { HanabiGameActionType } from 'app/src/games/hanabi/HanabiGameData';
import useValueChanged from 'app/src/utils/client/useValueChanged';
import { useEffect, useRef } from 'react';

function playAudio(ele: HTMLAudioElement) {
	try {
		ele.play();
	} catch (error) {
		console.log('Cannot play audio clip: ', error);
	}
}

export default function HanabiSoundsController(): null {
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
	const game = useHanabiGame();

	const newestAction = game.gameData.actions.length
		? game.gameData.actions[game.gameData.actions.length - 1]
		: null;

	const actionsChanged = useValueChanged(game.gameData.actions.length);
	console.log({ actionsChanged });

	useEffect(() => {
		if (!actionsChanged) {
			return;
		}

		if (!newestAction) {
			return;
		}

		if (newestAction.type === HanabiGameActionType.Play) {
			if (newestAction.valid) {
				playAudio(rightRef.current!);
			} else {
				playAudio(wrongRef.current!);
			}
		} else if (
			newestAction.type === HanabiGameActionType.Discard ||
			newestAction.type === HanabiGameActionType.GiveColorClue ||
			newestAction.type === HanabiGameActionType.GiveNumberClue
		) {
			playAudio(beepRef.current!);
		}
	}, [actionsChanged, newestAction, userId]);

	return null;
}
