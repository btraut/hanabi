import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminApi, { AdminApiError } from './AdminApi';

describe('AdminApi', () => {
	afterEach(() => vi.restoreAllMocks());

	it('uses a same-origin session for dashboard requests', async () => {
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(new Response(null, { status: 204 }))
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ items: [], page: 2, pageSize: 25, total: 0 }), {
					status: 200,
				}),
			)
			.mockResolvedValueOnce(new Response(null, { status: 204 }));

		await AdminApi.login('tenfour');
		await expect(AdminApi.games(2)).resolves.toMatchObject({ page: 2, items: [] });
		await AdminApi.logout();

		expect(fetchMock).toHaveBeenNthCalledWith(
			1,
			'/api/admin/session',
			expect.objectContaining({ credentials: 'same-origin', method: 'POST' }),
		);
		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
			'/api/admin/transcripts?page=2',
			expect.objectContaining({ credentials: 'same-origin' }),
		);
		expect(fetchMock).toHaveBeenNthCalledWith(
			3,
			'/api/admin/session',
			expect.objectContaining({ method: 'DELETE' }),
		);
	});

	it('exposes the response status without retaining the password', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 401 }));

		await expect(AdminApi.login('wrong')).rejects.toEqual(
			expect.objectContaining<Partial<AdminApiError>>({ status: 401 }),
		);
	});
});
