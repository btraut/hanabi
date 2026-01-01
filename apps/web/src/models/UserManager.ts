import { User, UserType } from '@hanabi/shared';

class UserManager {
	private _users: { [id: string]: User } = {};
	public get users() {
		return this._users;
	}

	public addUser(id: string, type = UserType.Unknown) {
		const newUser = new User(id, type);
		this._users[id] = newUser;
		return newUser;
	}

	public pruneOldUsers() {
		// Users older than an hour should be deleted.
		const oldestUserTime = new Date(new Date().getTime() - 60 * 60 * 1000);

		// Iterate over all users and collect ids of pruned entries.
		const prunedEntries = [];
		for (const id of Object.keys(this._users)) {
			const game = this._users[id];

			if (game.updated < oldestUserTime) {
				prunedEntries.push(this._users[id]);
				delete this._users[id];
			}
		}

		// Send back a list of all we've pruned.
		return prunedEntries;
	}
}

const instance = new UserManager();
export default instance;
