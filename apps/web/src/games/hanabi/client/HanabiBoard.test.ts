import { getHanabiBoardLayout } from './HanabiBoardLayout';
import { describe, expect, it } from 'vitest';

describe('Hanabi board responsive layout', () => {
	it('uses the desktop composition only at the xl gate', () => {
		expect(getHanabiBoardLayout({ xl: false })).toBe('legacy');
		expect(getHanabiBoardLayout({ xl: true })).toBe('desktop');
	});
});
