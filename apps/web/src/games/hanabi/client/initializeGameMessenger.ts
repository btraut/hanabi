interface InitializableGameMessenger {
	refreshGameData(): Promise<void>;
	cleanUp(): void;
}

export async function initializeGameMessenger<T extends InitializableGameMessenger>(
	messenger: T,
): Promise<T> {
	try {
		await messenger.refreshGameData();
		return messenger;
	} catch (error) {
		messenger.cleanUp();
		throw error;
	}
}
