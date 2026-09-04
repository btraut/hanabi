import HanabiCheckbox from './HanabiCheckbox';
import HanabiDropdown from './HanabiDropdown';
import HanabiLinkButton from './HanabiLinkButton';
import HanabiMenuButton from './HanabiMenuButton';
import HanabiTextInput from './HanabiTextInput';
import HanabiCopyLinkButton from '../HanabiCopyLinkButton';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

describe('Hanabi controls', () => {
	it('shares one compact button language across buttons and links', () => {
		const button = renderToStaticMarkup(
			createElement(HanabiMenuButton, { label: 'New game', onClick: vi.fn() }),
		);
		const primaryButton = renderToStaticMarkup(
			createElement(HanabiMenuButton, {
				label: 'Start game',
				onClick: vi.fn(),
				variant: 'primary',
			}),
		);
		const link = renderToStaticMarkup(
			createElement(HanabiLinkButton, { href: '/', label: 'Back to home' }),
		);

		for (const control of [button, primaryButton, link]) {
			expect(control).toContain('hanabi-button');
			expect(control).not.toContain('border-4');
			expect(control).not.toContain('uppercase');
		}
		expect(primaryButton).toContain('hanabi-button-primary');
	});

	it('renders the game-code action as a regular button when requested', () => {
		const copyCode = renderToStaticMarkup(
			createElement(HanabiCopyLinkButton, { link: 'X7K2', variant: 'button' }),
		);

		expect(copyCode).toContain('hanabi-button hanabi-button-wide hanabi-copy-button');
		expect(copyCode).toContain('Copy game code');
		expect(copyCode).toContain('hanabi-copy-button-label');
		expect(copyCode).toContain('hanabi-copy-button-separator');
		expect(copyCode).toContain('hanabi-copy-button-code');
		expect(copyCode).toContain('X7K2');
		expect(copyCode).not.toContain('hanabi-copy-control');
	});

	it('truncates long lobby links before the copy action', () => {
		const copyLink = renderToStaticMarkup(
			createElement(HanabiCopyLinkButton, {
				link: 'https://hanabi.btraut.com/EXAMPLE',
			}),
		);

		expect(copyLink).toContain('hanabi-copy-control');
		expect(copyLink).toContain('min-w-0 truncate font-mono');
		expect(copyLink).toContain('aria-label="Copy game link https://hanabi.btraut.com/EXAMPLE"');
	});

	it('uses the same compact field language for text, select, and checkbox inputs', () => {
		const textInput = renderToStaticMarkup(createElement(HanabiTextInput, { id: 'name' }));
		const dropdown = renderToStaticMarkup(
			createElement(HanabiDropdown, {
				id: 'rules',
				onChange: vi.fn(),
				options: { Basic: 'basic' },
				value: 'basic',
			}),
		);
		const checkbox = renderToStaticMarkup(
			createElement(HanabiCheckbox, {
				checked: true,
				id: 'sound',
				onChange: vi.fn(),
			}),
		);

		expect(textInput).toContain('hanabi-field');
		expect(dropdown).toContain('hanabi-field');
		expect(checkbox).toContain('hanabi-checkbox');
		for (const control of [textInput, dropdown, checkbox]) {
			expect(control).not.toContain('border-4');
		}
	});
});

describe('Hanabi dialog system', () => {
	it('uses a semantic dialog with X, Escape, and backdrop dismissal', () => {
		const source = readFileSync(new URL('./HanabiDialog.tsx', import.meta.url), 'utf8');

		expect(source).toContain('aria-modal="true"');
		expect(source).toContain('role="dialog"');
		expect(source).toContain("event.key === 'Escape'");
		expect(source).toContain('event.target === event.currentTarget');
		expect(source).toContain('onPointerDown={handleBackdropPointerDown}');
		expect(source).toContain('<HanabiXButton');
		expect(source).toContain('returnFocus');
	});

	it('keeps its portal node stable and exposes dialog state from the trigger', () => {
		const portal = readFileSync(
			new URL('../../../../components/Portal.tsx', import.meta.url),
			'utf8',
		);
		const trigger = readFileSync(new URL('../HanabiHamburgerButton.tsx', import.meta.url), 'utf8');

		expect(portal).toContain("useState(() => document.createElement('div'))");
		expect(trigger).toContain('aria-expanded={expanded}');
		expect(trigger).toContain('aria-haspopup="dialog"');
		expect(trigger).toContain('aria-label="Open game menu"');
	});

	it('keeps sound settings in the game menu instead of a second dialog', () => {
		const menu = readFileSync(new URL('../HanabiGameMenu.tsx', import.meta.url), 'utf8');
		const trigger = readFileSync(new URL('../HanabiHeaderMenuButton.tsx', import.meta.url), 'utf8');

		expect(menu).toContain('Play sounds');
		expect(menu).toContain('Restart game');
		expect(menu).not.toContain('Invite players');
		expect(menu).toContain('<HanabiCopyLinkButton link={code} variant="button" />');
		expect(menu).toContain('useHanabiOptionsContext');
		expect(menu).not.toContain('label="Options"');
		expect(menu).not.toContain('label="Close"');
		expect(trigger).not.toContain('HanabiOptionsMenu');
		expect(trigger).not.toContain('showOptionsMenu');
	});

	it('uses the shared dismissible shell for game-over dialogs', () => {
		const source = readFileSync(new URL('../HanabiGameOverPopup.tsx', import.meta.url), 'utf8');

		expect(source).toContain('<HanabiDialog');
		expect(source).toContain('onClose={onClose}');
		expect(source).not.toContain('label="Close"');
	});
});
