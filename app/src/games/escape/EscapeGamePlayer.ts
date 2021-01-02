import { Location } from 'app/src/games/escape/Movement';

export default interface EscapeGamePlayer {
	id: string;
	connected: boolean;
	name: string;
	location: Location;
}
