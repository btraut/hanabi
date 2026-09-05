export default function HanabiStyles(): JSX.Element {
	return (
		<style>{`
@keyframes hanabi-clue-mark-arrive {
	0% { opacity: 0; transform: scale(0.88); }
	58% { opacity: 1; transform: scale(1.08); }
	100% { opacity: 1; transform: scale(1); }
}

@keyframes hanabi-clue-mark-breathe {
	0%, 100% { filter: drop-shadow(0 0 5px rgb(var(--hanabi-emphasis-rgb) / 60%)); }
	50% { filter: drop-shadow(0 0 8px rgb(var(--hanabi-emphasis-rgb) / 85%)); }
}

.hanabi-tile-surface-clipped {
	clip-path: polygon(
		0 0,
		100% 0,
		100% calc(100% - var(--hanabi-tile-note-fold-size)),
		calc(100% - var(--hanabi-tile-note-fold-size)) 100%,
		0 100%
	);
}

.hanabi-tile-note-marker {
	position: absolute;
	right: 0;
	bottom: 0;
	z-index: 24;
	width: var(--hanabi-tile-note-fold-size);
	height: var(--hanabi-tile-note-fold-size);
	overflow: hidden;
	border-bottom-right-radius: inherit;
}

.hanabi-tile-note-marker svg {
	display: block;
	width: 100%;
	height: 100%;
	overflow: visible;
}

.hanabi-tile-note-shadow {
	fill: rgb(0 0 0 / 78%);
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

.hanabi-tile-emphasis-mark {
	position: absolute;
	inset: 0;
	z-index: 26;
	width: 100%;
	height: 100%;
	overflow: visible;
	pointer-events: none;
	color: rgb(var(--hanabi-emphasis-rgb));
	filter: drop-shadow(0 0 5px rgb(var(--hanabi-emphasis-rgb) / 60%));
	animation:
		hanabi-clue-mark-arrive 520ms cubic-bezier(0.2, 0.8, 0.2, 1) both,
		hanabi-clue-mark-breathe 1800ms ease-in-out 520ms 2 both;
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
	.hanabi-tile-emphasis-mark {
		animation: none;
	}
}

	`}</style>
	);
}
