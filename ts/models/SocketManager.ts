// import GamesManager from './GamesManager';
import UserManager from './UserManager';
import Logger from '../utils/Logger';

class SocketManager {
	constructor() {
		// Set an interval to prune users.
		setInterval(() => {
			const prunedUsers = UserManager.pruneOldUsers();
			
			if (prunedUsers.length) {
				Logger.debug(`Pruned users: ${ prunedUsers.join(', ') }`);
			}
		}, 5 * 60 * 1000);
	}
	
	public handleConnection(id: string) {
		const user = UserManager.addUser(id);
		Logger.debug(`User connected: ${ user.id }`);
	}
	
	public handleDisconnection(id: string) {
		const user = UserManager.users[id];
		
		if (!user) {
			Logger.debug('User disconnected: unknown id');
			return;
		}
		
		user.isConnected = false;
		Logger.debug(`User disconnected: ${ user.id }`);
	}
	
	public handleEvent(id: string, data: any) {
		const user = UserManager.users[id];
		
		if (!user) {
			return;
		}
		
		Logger.debug(data);
		
		user.ping();
	}
}

const instance = new SocketManager();
export default instance;
