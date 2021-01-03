// What is this? Before I realized that signalhub (and webrtc-swarm) were
// horribly old and unbuildable, I built this to connect with the rest of the
// app. This was used in conjunction with SignalHubManager. This should probably
// just be deleted.

/*
import SignalHubManager from 'app/src/games/escape/client/streams/SignalHubManager';
import useForceRefresh from 'app/src/utils/client/useForceRefresh';
import { useRef } from 'react';

export default function useSignalHubManager(hubId: string): SignalHubManager {
	const forceRefresh = useForceRefresh();

	const managerRef = useRef<SignalHubManager | null>(null);

	if (managerRef.current && managerRef.current.hubId !== hubId) {
		managerRef.current.cleanUp();
		managerRef.current = null;
	}

	if (!managerRef.current) {
		managerRef.current = new SignalHubManager(hubId);
		managerRef.current.onUpdate.subscribe(forceRefresh);
	}

	return managerRef.current;
}
*/
