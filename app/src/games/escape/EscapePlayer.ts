import { Location } from 'app/src/games/escape/Movement';

export default interface EscapePlayer {
	id: string;
	connected: boolean;
	name: string;
	location: Location;
}

export function generatePlayer(data: Partial<EscapePlayer> = {}): EscapePlayer {
	return {
		...{
			connected: true,
			id: '',
			name: '',
			location: {
				x: 0,
				y: 0,
			},
		},
		...data,
	};
}
