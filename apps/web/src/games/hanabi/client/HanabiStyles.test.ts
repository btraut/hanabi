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
		expect(styles).toMatch(
			/\.hanabi-tableau-lane\[data-tableau-color='rainbow'\]::before\s*\{[^}]*#df5148[^}]*#8d67bd/s,
		);
		expect(styles).toMatch(
			/\.hanabi-tableau-lane\[data-tableau-color='rainbow'\] \.hanabi-tableau-emblem\s*\{[^}]*linear-gradient\([^}]*rgb\(213 64 59 \/ 30%\)[^}]*rgb\(128 87 178 \/ 32%\)/s,
		);
		expect(styles).toMatch(
			/\.hanabi-tableau-divider\s*\{[^}]*height:\s*100%;[^}]*align-self:\s*stretch;[^}]*background:\s*rgb\(var\(--hanabi-tableau-accent\) \/ 28%\);/s,
		);
		expect(styles).not.toMatch(
			/\.hanabi-tableau-play-stack\s*\{[^}]*justify-content:\s*flex-end;/s,
		);
		expect(styles).toMatch(
			/\.hanabi-tableau-lane\s*\{[^}]*height:\s*var\(--hanabi-tableau-row-height, 80px\);/s,
		);
		expect(styles).toMatch(
			/\.hanabi-tableau-emblem\s*\{[^}]*width:\s*var\(--hanabi-tableau-row-height, 80px\);[^}]*padding:\s*8px;/s,
		);
		expect(styles.match(/^\s*\.hanabi-tableau-lane\s*\{/gm)).toHaveLength(2);
		expect(styles.match(/^\s*\.hanabi-tableau-play-stack\s*\{/gm)).toHaveLength(2);
		expect(styles.match(/^\s*\.hanabi-tableau-emblem\s*\{/gm)).toHaveLength(2);
		expect(styles).not.toMatch(/grid-template-columns:\s*90px (?:102|112|120|122)px 1px/);
		expect(styles).toMatch(
			/\.hanabi-desktop-board\s*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/,
		);
		expect(styles).toMatch(
			/@media \(width < 1440px\)[^{]*\{[\s\S]*?\.hanabi-desktop-board\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/,
		);
		expect(styles).toMatch(
			/@media \(width < 1440px\)[^{]*\{[\s\S]*?\[data-desktop-region='activity'\]\s*\{[^}]*width:\s*100%;[^}]*grid-column:\s*1 \/ -1;[^}]*justify-self:\s*stretch;/,
		);
		expect(styles).toMatch(
			/@media \(width < 960px\)[^{]*\{[\s\S]*?\[data-desktop-region='tableau'\],[\s\S]*?width:\s*100%;/,
		);
		expect(styles).not.toContain('@media (width < 1500px)');
		expect(styles).not.toContain('@media (width < 1360px)');
		expect(styles).not.toContain('@media (width < 1280px)');
		expect(styles).not.toContain('@media (width < 400px)');
	});

	it('lays out the desktop turn banner and game status as equal-height peers', () => {
		const styles = readFileSync(new URL('../../../styles/tailwind.css', import.meta.url), 'utf8');

		expect(styles).toMatch(
			/\.hanabi-status-regions\s*\{[^}]*grid-column:\s*1 \/ -1;[^}]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 2fr\);[^}]*height:\s*86px;/s,
		);
		expect(styles).toMatch(
			/@media \(width < 1440px\)[^{]*\{[\s\S]*?\.hanabi-status-regions\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/,
		);
		const peerSizingRule = styles.match(
			/\.hanabi-turn-banner,\s*\.hanabi-desktop-status\s*\{[^}]*\}/s,
		)?.[0];
		expect(peerSizingRule).toContain('height: 86px');
		expect(peerSizingRule).toContain('width: 100%');
		expect(peerSizingRule).toContain('align-self: stretch');
		expect(peerSizingRule).toContain('box-sizing: border-box');
		expect(styles).toMatch(
			/@media \(width < 960px\)[^{]*\{[\s\S]*?\.hanabi-status-regions\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);[^}]*height:\s*auto;/,
		);
		expect(styles).toMatch(
			/@media \(width < 960px\)[^{]*\{[\s\S]*?\.hanabi-turn-banner,\s*\.hanabi-desktop-status\s*\{[^}]*height:\s*86px;/,
		);
	});

	it('keeps tablet internals stable and gives mobile one deliberate compact composition', () => {
		const styles = readFileSync(new URL('../../../styles/tailwind.css', import.meta.url), 'utf8');
		const tabletRules = styles.match(
			/@media \(width < 1440px\)[^{]*\{[\s\S]*?(?=@media \(width < 960px\))/,
		)?.[0];
		const phoneRules = styles.match(
			/@media \(width < 640px\)[^{]*\{[\s\S]*?(?=@media \(width < 960px\))/,
		)?.[0];
		const drawerRules = styles.match(
			/@media \(width < 960px\)[^{]*\{[\s\S]*?(?=@media \(width < 390px\))/,
		)?.[0];

		expect(tabletRules).not.toContain('.hanabi-turn-label');
		expect(tabletRules).not.toContain('.hanabi-status-item');
		expect(tabletRules).not.toContain('.hanabi-status-label');
		expect(tabletRules).not.toContain('.hanabi-status-value');
		expect(tabletRules).not.toContain('.hanabi-activity-tabs');
		expect(phoneRules).toContain('.hanabi-game-header');
		expect(phoneRules).toContain('.hanabi-status-regions');
		expect(phoneRules).toContain('grid-template-rows: 56px 52px');
		expect(phoneRules).toContain('.hanabi-mobile-game-menu');
		expect(phoneRules).toContain('.hanabi-tableau-emblem');
		expect(phoneRules).toContain('--hanabi-played-tile-overlap: -48px');
		expect(phoneRules).toContain("[data-discard-overlap='true']");
		expect(phoneRules).not.toContain('.hanabi-player-workspace');
		expect(drawerRules).toContain("[data-desktop-region='activity']");
		expect(drawerRules).toContain('.hanabi-mobile-chat-trigger');
		expect(drawerRules).toContain('.hanabi-mobile-sheet');
		expect(styles).not.toContain("[data-discard-count='6']");
		expect(styles).not.toContain("[data-discard-count='10']");
		expect(styles).not.toContain('@media (width < 420px)');
		expect(styles).not.toContain('transform: scale(0.68)');
	});

	it('keeps canonical card geometry while only the narrow workspace rail reflows', () => {
		const styles = readFileSync(new URL('../../../styles/tailwind.css', import.meta.url), 'utf8');

		expect(styles).toMatch(
			/@media \(width < 390px\)[^{]*\{[\s\S]*?\.hanabi-player-workspace\s*\{[^}]*grid-template-rows:\s*44px minmax\(0, 1fr\);/,
		);
		expect(styles).not.toContain('@media (width < 520px)');
		expect(styles).not.toContain('@media (width < 350px)');
		expect(styles).not.toMatch(
			/@media \(width < (?:640|390)px\)[^{]*\{[\s\S]*?--hanabi-player-tile-(?:width|height):/,
		);
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
		expect(styles).toMatch(
			/\.hanabi-tile-number\s*\{[^}]*text-shadow:\s*0 1px 1px rgb\(1 9 19 \/ 48%\);/s,
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
		expect(mobileTabRule).not.toContain('font-size:');
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

	it('renders clue information as a folded card corner instead of a clue token', () => {
		const markup = renderToStaticMarkup(createElement(HanabiStyles));
		const styles = readFileSync(new URL('../../../styles/tailwind.css', import.meta.url), 'utf8');

		const shellRule = markup.match(/\.hanabi-tile-shell\s*\{[^}]*\}/s)?.[0];
		expect(shellRule).toContain('--hanabi-tile-note-fold-size: 15px');
		const clippedSurfaceRule = markup.match(/\.hanabi-tile-surface-clipped\s*\{[^}]*\}/s)?.[0];
		expect(clippedSurfaceRule).toContain('clip-path: polygon(');
		expect(clippedSurfaceRule).toContain('100% calc(100% - var(--hanabi-tile-note-fold-size))');
		expect(clippedSurfaceRule).toContain('calc(100% - var(--hanabi-tile-note-fold-size)) 100%');
		const markerRule = markup.match(/\.hanabi-tile-note-marker\s*\{[^}]*\}/s)?.[0];
		expect(markerRule).toMatch(/right:\s*0;[^}]*bottom:\s*0;/s);
		expect(markerRule).toContain('width: var(--hanabi-tile-note-fold-size)');
		expect(markerRule).toContain('height: var(--hanabi-tile-note-fold-size)');
		expect(markerRule).toContain('overflow: hidden');
		expect(markerRule).toContain('border-bottom-right-radius: inherit');
		expect(markup).toContain('.hanabi-tile-note-shadow');
		expect(markup).toContain('fill: rgb(0 0 0 / 78%)');
		const shadowRule = markup.match(/\.hanabi-tile-note-shadow\s*\{[^}]*\}/s)?.[0];
		expect(shadowRule).not.toContain('filter:');
		expect(markup).not.toContain('.hanabi-tile-note-underfold');
		expect(markup).not.toContain('.hanabi-tile-note-paper');
		expect(markup).not.toContain('.hanabi-tile-note-highlight');
		expect(markup).not.toContain('.hanabi-tile-note-crease');
		expect(markup).not.toContain('.hanabi-tile-note-marker::before');
		expect(markup).not.toContain('.hanabi-tile-note-marker::after');
		expect(markerRule).not.toContain('animation:');
		expect(markerRule).not.toContain('border-radius: 50%');
		expect(markerRule).not.toContain('73 141 242');
		expect(markup).not.toContain('--hanabi-clue-token-inset');
		expect(styles).toMatch(
			/\.hanabi-clue-token\s*\{[^}]*border-radius:\s*50%;[^}]*radial-gradient\(circle at 38% 32%/s,
		);
		expect(styles).toContain('.hanabi-clue-token::after');
	});
});
