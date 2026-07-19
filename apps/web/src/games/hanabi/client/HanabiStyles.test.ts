import HanabiStyles from '~/games/hanabi/client/HanabiStyles';
import CardStack from '~/games/hanabi/client/icons/CardStack';
import ChatBubble from '~/games/hanabi/client/icons/ChatBubble';
import PaperPlane from '~/games/hanabi/client/icons/PaperPlane';
import Star from '~/games/hanabi/client/icons/Star';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

describe('Hanabi desktop visual foundation', () => {
	it('defines semantic colors, focus, and reduced-motion primitives', () => {
		const styles = readFileSync(new URL('../../../styles/tailwind.css', import.meta.url), 'utf8');

		expect(styles).toContain('--color-hanabi-table:');
		expect(styles).toContain('--color-hanabi-ivory:');
		expect(styles).toContain('--color-hanabi-coral:');
		expect(styles).toContain('--color-hanabi-purple:');
		expect(styles).toContain('.hanabi-focus-ring:focus-visible');
		expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
	});

	it('renders decorative icons with currentColor and no accessible duplication', () => {
		for (const Icon of [Star, CardStack, PaperPlane, ChatBubble]) {
			const markup = renderToStaticMarkup(createElement(Icon, { className: 'icon', size: 18 }));

			expect(markup).toContain('aria-hidden="true"');
			expect(markup).toContain('currentColor');
			expect(markup).toContain('height="18"');
			expect(markup).toContain('width="18"');
		}
	});

	it('gives titled icons a single image name', () => {
		const markup = renderToStaticMarkup(createElement(Star, { title: 'Score' }));

		expect(markup).toContain('role="img"');
		expect(markup).toContain('<title>Score</title>');
		expect(markup).not.toContain('aria-hidden');
	});

	it('disables the legacy marquee animation for reduced motion', () => {
		const markup = renderToStaticMarkup(createElement(HanabiStyles));

		expect(markup).toContain('prefers-reduced-motion: reduce');
		expect(markup).toContain('animation: none');
	});
});
