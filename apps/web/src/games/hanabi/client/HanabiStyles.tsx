export default function HanabiStyles(): JSX.Element {
	return (
		<style>{`
@keyframes hanabi-clue-mark-arrive {
	from { opacity: 0; }
	to { opacity: 1; }
}

@keyframes hanabi-clue-mark-breathe {
	0%, 100% { opacity: 0.15; }
	50% { opacity: 1; }
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
.hanabi-tile-emphasis-yellow { --hanabi-emphasis-rgb: 213 173 97; }
.hanabi-tile-emphasis-number { --hanabi-emphasis-rgb: 225 234 245; }
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
	animation: hanabi-clue-mark-arrive 200ms ease-out both;
}

.hanabi-tile-emphasis-outline,
.hanabi-tile-emphasis-glow,
.hanabi-tile-emphasis-separator {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	overflow: visible;
}

.hanabi-tile-emphasis-outline {
	filter: drop-shadow(0 0 3px rgb(var(--hanabi-emphasis-rgb) / 80%));
}

/* Keep the blur fixed so only the glow layer's opacity changes each frame. */
.hanabi-tile-emphasis-glow {
	filter: drop-shadow(0 0 5px rgb(var(--hanabi-emphasis-rgb))) drop-shadow(0 0 9px rgb(var(--hanabi-emphasis-rgb) / 75%));
	will-change: opacity;
	animation: hanabi-clue-mark-breathe 1600ms ease-in-out infinite;
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
	.hanabi-tile-emphasis-mark,
	.hanabi-tile-emphasis-glow {
		animation: none;
	}
	.hanabi-tile-emphasis-glow {
		opacity: 0.55;
		will-change: auto;
	}
}

	`}</style>
	);
}
