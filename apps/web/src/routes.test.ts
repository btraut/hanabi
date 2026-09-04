import AdminPage from '~/admin/AdminPage';
import HanabiPage from '~/games/hanabi/HanabiPage';
import routes from './routes';
import { describe, expect, it } from 'vitest';

describe('routes', () => {
	it('keeps the unlinked admin archive separate from the game wildcard', () => {
		expect(routes).toMatchObject([
			{ path: '/admin', Component: AdminPage },
			{ path: '/*', Component: HanabiPage },
		]);
	});
});
