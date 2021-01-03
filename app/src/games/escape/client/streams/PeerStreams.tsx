import Stream, { StreamConnection } from 'app/src/games/escape/client/streams/Stream';

interface Props {
	peerStreams: { [id: string]: StreamConnection };
	swarmInitialized: boolean;
}

export default function PeerStreams({ peerStreams, swarmInitialized }: Props): JSX.Element {
	const peerStreamIds = Object.keys(peerStreams);

	// TODO: show controls/labels for players

	return (
		<div className="PeerStreams">
			{!swarmInitialized && <p>Connecting…</p>}
			{swarmInitialized &&
				peerStreamIds.map((id) => <Stream key={id} connection={peerStreams[id]} />)}
		</div>
	);
}
