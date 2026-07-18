export type LoadRetryWait = () => Promise<void>;

const waitBeforeRetry: LoadRetryWait = () =>
	new Promise((resolve) => {
		setTimeout(resolve, 1000);
	});

export async function loadGameUntilSuccessful(
	loadGame: () => Promise<void>,
	shouldContinue: () => boolean,
	wait: LoadRetryWait = waitBeforeRetry,
	shouldRetry: (error: unknown) => boolean = () => true,
): Promise<boolean> {
	while (shouldContinue()) {
		try {
			await loadGame();
			return true;
		} catch (error) {
			if (!shouldRetry(error)) throw error;
			if (!shouldContinue()) return false;
			await wait();
		}
	}

	return false;
}
