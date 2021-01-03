import { Location } from 'app/src/games/escape/Movement';

export default interface EscapeGamePlayer {
	id: string;
	connected: boolean;
	name: string;
	location: Location;
}

export function generatePlayer(data: Partial<EscapeGamePlayer> = {}): EscapeGamePlayer {
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
