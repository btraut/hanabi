export default function HanabiStyles(): JSX.Element {
	return (
		<style>{`
@keyframes hanabi-clue-mark-arrive {
	0% { opacity: 0; transform: scale(0.88); }
	58% { opacity: 1; transform: scale(1.08); }
	100% { opacity: 1; transform: scale(1); }
}

@keyframes hanabi-clue-mark-breathe {
	0%, 100% {
		box-shadow:
			inset 0 0 0 1px rgb(255 250 239 / 96%),
			0 0 0 1px rgb(3 14 27 / 96%),
			0 0 12px rgb(var(--hanabi-emphasis-rgb) / 68%),
			0 0 24px rgb(var(--hanabi-emphasis-rgb) / 22%);
	}
	50% {
		box-shadow:
			inset 0 0 0 1px rgb(255 250 239 / 100%),
			0 0 0 1px rgb(3 14 27 / 100%),
			0 0 18px rgb(var(--hanabi-emphasis-rgb) / 92%),
			0 0 34px rgb(var(--hanabi-emphasis-rgb) / 42%);
	}
}

.hanabi-tile-emphasis,
.hanabi-player-tile-emphasis {
	--hanabi-emphasis-rgb: 218 113 99;
}

.hanabi-tile-emphasis-red { --hanabi-emphasis-rgb: 211 107 101; }
.hanabi-tile-emphasis-blue { --hanabi-emphasis-rgb: 99 143 209; }
.hanabi-tile-emphasis-green { --hanabi-emphasis-rgb: 108 171 127; }
.hanabi-tile-emphasis-yellow,
.hanabi-tile-emphasis-number { --hanabi-emphasis-rgb: 213 173 97; }
.hanabi-tile-emphasis-white { --hanabi-emphasis-rgb: 238 233 223; }
.hanabi-tile-emphasis-purple { --hanabi-emphasis-rgb: 146 120 196; }
.hanabi-tile-emphasis-black { --hanabi-emphasis-rgb: 115 128 150; }
.hanabi-tile-emphasis-rainbow { --hanabi-emphasis-rgb: 237 149 136; }
.hanabi-tile-emphasis-action { --hanabi-emphasis-rgb: 218 113 99; }

.hanabi-clue-pill {
	--hanabi-emphasis-rgb: 213 173 97;
	color: rgb(var(--hanabi-emphasis-rgb));
	background: rgb(var(--hanabi-emphasis-rgb) / 12%);
	border-color: rgb(var(--hanabi-emphasis-rgb) / 55%);
	box-shadow: 0 0 10px rgb(var(--hanabi-emphasis-rgb) / 16%);
}
.hanabi-clue-pill-red { --hanabi-emphasis-rgb: 211 107 101; }
.hanabi-clue-pill-blue { --hanabi-emphasis-rgb: 99 143 209; }
.hanabi-clue-pill-green { --hanabi-emphasis-rgb: 108 171 127; }
.hanabi-clue-pill-yellow,
.hanabi-clue-pill-number { --hanabi-emphasis-rgb: 213 173 97; }
.hanabi-clue-pill-white { --hanabi-emphasis-rgb: 238 233 223; }
.hanabi-clue-pill-purple { --hanabi-emphasis-rgb: 146 120 196; }
.hanabi-clue-pill-black { --hanabi-emphasis-rgb: 115 128 150; }
.hanabi-clue-pill-rainbow { --hanabi-emphasis-rgb: 237 149 136; }

.hanabi-tile-emphasis::after,
.hanabi-player-tile-emphasis::after {
	content: '';
	pointer-events: none;
	animation:
		hanabi-clue-mark-arrive 520ms cubic-bezier(0.2, 0.8, 0.2, 1) both,
		hanabi-clue-mark-breathe 1800ms ease-in-out 520ms 2 both;
}

.hanabi-tile-emphasis::after,
.hanabi-player-tile-emphasis::after {
	position: absolute;
	inset: -3px;
	z-index: 20;
	border: 3px solid rgb(var(--hanabi-emphasis-rgb));
	border-radius: 11px;
	box-shadow:
		inset 0 0 0 1px rgb(255 250 239 / 96%),
		0 0 0 1px rgb(3 14 27 / 96%),
		0 0 12px rgb(var(--hanabi-emphasis-rgb) / 68%),
		0 0 24px rgb(var(--hanabi-emphasis-rgb) / 22%);
}
@keyframes bg-blue-to-red {
  0% { background-color: #1e3a8a; }
  50% { background-color: #be123d; }
  100% { background-color: #1e3a8a; }
}

.text-rainbow {
	background: var(--hanabi-tile-ink-rainbow);
	-webkit-background-clip: text;
	background-clip: text;
	-webkit-text-fill-color: transparent;
}
.bg-rainbow {
	background: var(--hanabi-tile-ink-rainbow);
}

@media (prefers-reduced-motion: reduce) {
	.hanabi-tile-emphasis::after,
	.hanabi-player-tile-emphasis::after {
		animation: none;
	}
}

	`}</style>
	);
}
