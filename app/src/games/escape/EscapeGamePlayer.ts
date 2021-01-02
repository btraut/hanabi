import { Location } from 'app/src/games/escape/Movement';

export default interface EscapeGamePlayer {
	id: string;
	name: string;
	location: Location;
}
