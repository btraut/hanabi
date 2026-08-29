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
	it('uses the self-hosted condensed UI typeface while preserving card numerals', () => {
		const entry = readFileSync(new URL('../../../main.tsx', import.meta.url), 'utf8');
		const styles = readFileSync(new URL('../../../styles/tailwind.css', import.meta.url), 'utf8');

		for (const fontImport of [
			'@fontsource/barlow-condensed/latin-400.css',
			'@fontsource/barlow-condensed/latin-400-italic.css',
			'@fontsource/barlow-condensed/latin-500.css',
			'@fontsource/barlow-condensed/latin-600.css',
			'@fontsource/barlow-condensed/latin-700.css',
		]) {
			expect(entry).toContain(fontImport);
		}

		expect(styles).toMatch(/--font-sans:\s*'Barlow Condensed'/);
		expect(styles).toMatch(
			/body\s*\{[^}]*font-family:\s*var\(--font-sans\);[^}]*font-weight:\s*500;/s,
		);
		expect(styles).toMatch(
			/\.hanabi-tile-number\s*\{[^}]*font-family:\s*Georgia, 'Times New Roman', serif;/s,
		);
	});

	it('defines semantic colors, focus, and reduced-motion primitives', () => {
		const styles = readFileSync(new URL('../../../styles/tailwind.css', import.meta.url), 'utf8');

		expect(styles).toContain('--color-hanabi-table:');
		expect(styles).toContain('--color-hanabi-ivory:');
		expect(styles).toContain('--color-hanabi-coral:');
		expect(styles).toContain('--color-hanabi-purple:');
		expect(styles).toContain('.hanabi-focus-ring:focus-visible');
		expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
	});

	it('keeps tableau emblem blocks crisp instead of fading into their lanes', () => {
		const styles = readFileSync(new URL('../../../styles/tailwind.css', import.meta.url), 'utf8');

		expect(styles).not.toContain(
			'linear-gradient(90deg, transparent 76%, rgb(6 25 44 / 88%) 100%)',
		);
	});

	it('lays out the desktop turn banner and game status as equal-height peers', () => {
		const styles = readFileSync(new URL('../../../styles/tailwind.css', import.meta.url), 'utf8');

		expect(styles).toMatch(
			/\.hanabi-status-regions\s*\{[^}]*grid-template-columns:\s*minmax\(270px, 1fr\) 650px;[^}]*height:\s*86px;/s,
		);
		const peerSizingRule = styles.match(
			/\.hanabi-turn-banner,\s*\.hanabi-desktop-status\s*\{[^}]*\}/s,
		)?.[0];
		expect(peerSizingRule).toContain('height: 100%');
		expect(peerSizingRule).toContain('width: 100%');
	});

	it('keeps every modern card portrait and preserves the square back emblem', () => {
		const styles = readFileSync(new URL('../../../styles/tailwind.css', import.meta.url), 'utf8');

		expect(styles).toContain('--hanabi-player-tile-width: 50px');
		expect(styles).toContain('--hanabi-player-tile-height: 64px');
		expect(styles).not.toContain('--hanabi-player-tile-size:');
		expect(styles).toContain('mask-size: 62% auto');
		expect(styles).toContain('-webkit-mask-size: 62% auto');
	});

	it('renders authored card faces without synthetic motif layers', () => {
		const styles = readFileSync(new URL('../../../styles/tailwind.css', import.meta.url), 'utf8');

		expect(styles).toMatch(
			/\.hanabi-tile-face\s*\{[^}]*background-image:\s*var\(--hanabi-tile-face-art\);[^}]*background-size:\s*100% 100%;/s,
		);
		expect(styles).toMatch(
			/\.hanabi-tile-face\s*\{[^}]*--hanabi-card-frame:\s*#e8dcc2;[^}]*border:\s*1px solid var\(--hanabi-card-frame\);/s,
		);
		expect(styles).toMatch(
			/\.hanabi-player-tile \.hanabi-tile-back,[\s\S]*?\.hanabi-player-tile \.hanabi-tile-face\s*\{[^}]*inset 0 0 0 1px var\(--hanabi-card-hairline,/s,
		);
		expect(styles).toMatch(/\.hanabi-tile-back\s*\{[^}]*border:\s*1px solid #d9cfba;/s);
		expect(styles).not.toContain('.hanabi-tile-art');
		expect(styles).not.toContain('.hanabi-tile-face::before');
		expect(styles).not.toContain('--hanabi-tile-face-background');
		expect(styles).toMatch(
			/\.hanabi-tile-number\s*\{[^}]*color:\s*var\(--hanabi-tile-number-color, #fff9eb\) !important;/s,
		);
	});

	it('keeps the authored rainbow face flattened into a single layer', () => {
		const styles = readFileSync(new URL('../../../styles/tailwind.css', import.meta.url), 'utf8');

		expect(styles).not.toContain('hanabi-rainbow-drift');
		expect(styles).not.toMatch(/\[data-hanabi-tile-color='rainbow'\]\s*\{[^}]*background:/s);
	});

	it('scales every tile number from the tile width without context overrides', () => {
		const styles = readFileSync(new URL('../../../styles/tailwind.css', import.meta.url), 'utf8');

		expect(styles).toMatch(
			/\.hanabi-tile-number\s*\{[^}]*left:\s*50%;[^}]*font-size:\s*var\(--hanabi-tile-number-size\);[^}]*transform:\s*translateX\(-50%\);/s,
		);
		expect(styles).not.toMatch(/\.hanabi-player-tile \.hanabi-tile-number\s*\{/);
		expect(styles).not.toMatch(
			/\.hanabi-tableau-lane \[role='listitem'\] \.hanabi-tile-number\s*\{/,
		);
	});

	it('keeps mobile activity tabs together with equal typography', () => {
		const styles = readFileSync(new URL('../../../styles/tailwind.css', import.meta.url), 'utf8');

		const mobileTabsRule = styles.match(/\.hanabi-mobile-activity-tabs\s*\{[^}]*\}/s)?.[0];
		expect(mobileTabsRule).toContain('grid-template-columns: repeat(2, max-content)');
		expect(mobileTabsRule).toContain('justify-content: start');

		const mobileTabRule = styles.match(
			/\.hanabi-mobile-activity-tabs \.hanabi-activity-tab\s*\{[^}]*\}/s,
		)?.[0];
		expect(mobileTabRule).toContain('font-size: 22px');
		expect(styles).not.toContain('.hanabi-mobile-activity-tabs .hanabi-activity-tab:first-child');
	});

	it('does not advertise nonexistent drag behavior on the mobile activity sheet', () => {
		const styles = readFileSync(new URL('../../../styles/tailwind.css', import.meta.url), 'utf8');
		const activityRail = readFileSync(new URL('./HanabiActivityRail.tsx', import.meta.url), 'utf8');

		expect(styles).not.toContain('.hanabi-mobile-sheet-handle');
		expect(activityRail).not.toContain('hanabi-mobile-sheet-handle');
	});

	it('uses compact hover and focus feedback for clue controls', () => {
		const tooltip = readFileSync(
			new URL('./HanabiTileActionsTooltip.tsx', import.meta.url),
			'utf8',
		);

		expect(tooltip).not.toContain('hanabi-focus-ring size-11');
		expect(tooltip).not.toContain('hanabi-focus-ring min-h-11 min-w-11');
		expect(tooltip).toContain('border border-white/15');
		expect(tooltip).toContain('hover:border-hanabi-text-muted/80');
		expect(tooltip).toContain('focus-visible:ring-hanabi-text-muted/60');
		expect(tooltip).not.toContain('border-4 border-hanabi-table-deep');
		expect(tooltip).not.toContain('hover:border-hanabi-coral');
		expect(tooltip).toContain('text-2xl');
		expect(tooltip).toContain(
			'focus-visible:bg-hanabi-coral/15 focus-visible:text-hanabi-coral-soft',
		);
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

	it('uses a persistent clue seal with a reduced-motion fallback', () => {
		const markup = renderToStaticMarkup(createElement(HanabiStyles));

		expect(markup).toContain('.hanabi-tile-emphasis-red');
		expect(markup).toContain('.hanabi-tile-emphasis-number');
		expect(markup).toContain('@keyframes hanabi-clue-mark-arrive');
		expect(markup).toContain('@keyframes hanabi-clue-mark-breathe');
		expect(markup).toContain('.hanabi-player-tile-emphasis::after');
		expect(markup).not.toContain('.hanabi-player-tile-emphasis::before');
		expect(markup).toContain('hanabi-clue-mark-arrive 520ms');
		expect(markup).toContain('hanabi-clue-mark-breathe 1800ms ease-in-out 520ms 2 both');
		expect(markup).not.toContain('hanabi-clue-mark-breathe 1800ms ease-in-out 520ms infinite');
		expect(markup).toContain('border: 3px solid rgb(var(--hanabi-emphasis-rgb))');
		expect(markup).not.toContain('2300ms');
		expect(markup).toContain('prefers-reduced-motion: reduce');
		expect(markup).toContain('animation: none');
	});
});
