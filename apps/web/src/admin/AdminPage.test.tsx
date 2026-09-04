// @vitest-environment happy-dom

import AdminApi, { AdminApiError, AdminGamesPage } from './AdminApi';
import AdminPage from './AdminPage';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const gamePage: AdminGamesPage = {
	items: [
		{
			roundId: 'round-1',
			gameCode: 'FIRES',
			startedAt: '2026-09-03T17:30:00.000Z',
			status: 'finished',
			integrity: 'complete',
			playerNames: ['Ada', 'Grace'],
			moveCount: 31,
			score: 22,
			finishedReason: 'OutOfTurns',
		},
	],
	page: 1,
	pageSize: 25,
	total: 26,
};

describe('AdminPage', () => {
	let root: Root;

	beforeEach(() => {
		(
			globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
		).IS_REACT_ACT_ENVIRONMENT = true;
		document.body.innerHTML = '<div id="mount"></div>';
		root = createRoot(document.querySelector('#mount')!);
	});

	afterEach(() => {
		act(() => root.unmount());
		vi.restoreAllMocks();
		document.body.innerHTML = '';
	});

	async function renderPage(initialEntry = '/admin'): Promise<void> {
		await act(async () => {
			root.render(
				<MemoryRouter initialEntries={[initialEntry]}>
					<AdminPage />
				</MemoryRouter>,
			);
			await Promise.resolve();
		});
	}

	it('shows only the password gate when the session is unauthorized', async () => {
		vi.spyOn(AdminApi, 'games').mockRejectedValue(new AdminApiError(401, 'Unauthorized'));

		await renderPage();

		expect(document.querySelector('input[type="password"]')).not.toBeNull();
		expect(document.body.textContent).toContain('Game archive');
		expect(document.body.textContent).not.toContain('recorded games');
	});

	it('logs in and renders the lightweight game summary', async () => {
		vi.spyOn(AdminApi, 'games')
			.mockRejectedValueOnce(new AdminApiError(401, 'Unauthorized'))
			.mockResolvedValueOnce(gamePage);
		const login = vi.spyOn(AdminApi, 'login').mockResolvedValue();

		await renderPage();
		const input = document.querySelector<HTMLInputElement>('#admin-password')!;
		act(() => {
			Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
				input,
				'tenfour',
			);
			input.dispatchEvent(new Event('input', { bubbles: true }));
		});
		await act(async () => {
			document
				.querySelector('form')!
				.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
			await Promise.resolve();
		});

		expect(login).toHaveBeenCalledWith('tenfour');
		expect(document.body.textContent).toContain('Ada, Grace');
		expect(document.querySelector('time')?.dateTime).toBe('2026-09-03T17:30:00.000Z');
		expect(document.body.textContent).toContain('31');
		expect(document.body.textContent).toContain('Finished');
		expect(document.body.textContent).toContain('Complete');
		expect(document.body.textContent).toContain('Out of turns');
		expect(document.body.textContent).toContain('22');
		expect(document.body.textContent).not.toContain('Hanabi telemetry');
		expect(document.body.textContent).not.toContain('recorded game');
		expect(document.body.textContent).not.toContain('Sign out');
		expect(document.querySelector('input[type="password"]')).toBeNull();
	});

	it('loads the page number from the URL and advances pagination', async () => {
		const games = vi.spyOn(AdminApi, 'games').mockResolvedValue({
			...gamePage,
			page: 2,
			total: 51,
		});

		await renderPage('/admin?page=2');
		expect(games).toHaveBeenCalledWith(2);

		const next = [...document.querySelectorAll('button')].find(
			(button) => button.textContent === 'Next',
		)!;
		await act(async () => {
			next.click();
			await Promise.resolve();
		});

		expect(games).toHaveBeenCalledWith(3);
	});

	it('ignores an older page response that resolves after navigation', async () => {
		let resolveFirst!: (page: AdminGamesPage) => void;
		let resolveSecond!: (page: AdminGamesPage) => void;
		vi.spyOn(AdminApi, 'games')
			.mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)))
			.mockReturnValueOnce(new Promise((resolve) => (resolveSecond = resolve)));
		const router = createMemoryRouter([{ path: '/admin', element: <AdminPage /> }], {
			initialEntries: ['/admin'],
		});

		await act(async () => {
			root.render(<RouterProvider router={router} />);
			await Promise.resolve();
		});
		await act(async () => {
			await router.navigate('/admin?page=2');
		});
		await act(async () => {
			resolveSecond({ ...gamePage, page: 2, items: [{ ...gamePage.items[0], gameCode: 'NEW' }] });
			await Promise.resolve();
		});
		await act(async () => {
			resolveFirst({ ...gamePage, items: [{ ...gamePage.items[0], gameCode: 'STALE' }] });
			await Promise.resolve();
		});

		expect(document.body.textContent).toContain('NEW');
		expect(document.body.textContent).not.toContain('STALE');
	});

	it('redirects an out-of-range page to the last populated page', async () => {
		const games = vi
			.spyOn(AdminApi, 'games')
			.mockResolvedValueOnce({ items: [], page: 999, pageSize: 25, total: 26 })
			.mockResolvedValueOnce({ ...gamePage, page: 2, total: 26 });

		await renderPage('/admin?page=999');

		expect(games.mock.calls).toEqual([[999], [2]]);
		expect(document.body.textContent).toContain('Ada, Grace');
		expect(document.body.textContent).toContain('26–26 of 26');
	});

	it('backs up when concurrent counts make the current last page empty', async () => {
		const games = vi
			.spyOn(AdminApi, 'games')
			.mockResolvedValueOnce({ items: [], page: 2, pageSize: 25, total: 26 })
			.mockResolvedValueOnce({ ...gamePage, total: 26 });

		await renderPage('/admin?page=2');

		expect(games.mock.calls).toEqual([[2], [1]]);
		expect(document.body.textContent).toContain('Ada, Grace');
		expect(document.body.textContent).toContain('1–25 of 26');
	});
});
