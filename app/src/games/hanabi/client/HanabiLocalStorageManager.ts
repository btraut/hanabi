import store from 'store';

const LOCAL_STORAGE_KEYS = {
	USER_NAME: 'USER_NAME',
};

export default class HanabiLocalStorageManager {
	public static sharedInstance = new HanabiLocalStorageManager();

	public getUserName(): string | null {
		return store.get(LOCAL_STORAGE_KEYS.USER_NAME) || null;
	}

	public setUserName(name: string | null): void {
		store.set(LOCAL_STORAGE_KEYS.USER_NAME, name);
	}
}
