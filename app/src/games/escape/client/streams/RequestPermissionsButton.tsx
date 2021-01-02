import getMyStream from 'app/src/games/escape/client/streams/getMyStream';

interface Props {
	onPermissionsRequested: (result: {
		myStream: MediaStream | null;
		audioEnabled: boolean;
		videoEnabled: boolean;
	}) => void;
}

export default function RequestPermissionsButton({ onPermissionsRequested }: Props): JSX.Element {
	const handleRequestPerms = async () => {
		const { myStream, audioEnabled, videoEnabled } = await getMyStream();
		console.log({ audioEnabled, videoEnabled });
		onPermissionsRequested({ myStream, audioEnabled, videoEnabled });
	};

	return (
		<button type="button" onClick={handleRequestPerms}>
			Allow mic/cam access
		</button>
	);
}
