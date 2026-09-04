export type AdminGameStatus = 'in_progress' | 'finished' | 'reset';
export type AdminGameIntegrity = 'complete' | 'partial' | 'conflicted';

export interface AdminGameSummary {
	roundId: string;
	gameCode: string;
	recordedAt: string;
	status: AdminGameStatus;
	integrity: AdminGameIntegrity;
	playerNames: string[];
	moveCount: number;
	score: number | null;
	finishedReason: string | null;
}

export interface AdminGamesPage {
	items: AdminGameSummary[];
	page: number;
	pageSize: number;
	total: number;
}

export class AdminApiError extends Error {
	public constructor(
		public readonly status: number,
		message: string,
	) {
		super(message);
		this.name = 'AdminApiError';
	}
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
	const response = await fetch(url, {
		...init,
		credentials: 'same-origin',
		headers: {
			'Content-Type': 'application/json',
			...init?.headers,
		},
	});

	if (!response.ok) {
		throw new AdminApiError(response.status, `Request failed with HTTP ${response.status}.`);
	}

	if (response.status === 204) {
		return undefined as T;
	}

	return (await response.json()) as T;
}

export default class AdminApi {
	public static login(password: string): Promise<void> {
		return request('/api/admin/session', {
			method: 'POST',
			body: JSON.stringify({ password }),
		});
	}

	public static logout(): Promise<void> {
		return request('/api/admin/session', { method: 'DELETE' });
	}

	public static games(page: number): Promise<AdminGamesPage> {
		return request(`/api/admin/transcripts?page=${page}`);
	}
}
