import getMyStream from 'app/src/games/escape/client/streams/getMyStream';

interface Props {
	onPermissionsRequested: (result: {
		stream: MediaStream | null;
		audioEnabled: boolean;
		videoEnabled: boolean;
	}) => void;
}

export default function RequestPermissionsButton({ onPermissionsRequested }: Props): JSX.Element {
	const handleRequestPerms = async () => {
		const { stream, audioEnabled, videoEnabled } = await getMyStream();
		console.log({ audioEnabled, videoEnabled });
		onPermissionsRequested({ stream, audioEnabled, videoEnabled });
	};

	return (
		<button type="button" onClick={handleRequestPerms}>
			Allow mic/cam access
		</button>
	);
}
