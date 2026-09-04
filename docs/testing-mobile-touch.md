# Mobile touch testing

Responsive viewport emulation is not enough to test touch. The browser must emit touch input so Hanabi uses its touch drag backend and the card gesture recognizer sees `pointerType: "touch"`.

## Fast regression test

Run the focused gesture suite:

```sh
pnpm test:touch
```

This covers short taps, stationary long presses, movement beyond the drag threshold, canceled touches, compatibility click suppression, and accessible clue descriptions.

## Browser smoke test

Start the app with `pnpm dev`, create a game with tile reordering and notes enabled, and use Chrome DevTools' device toolbar with a phone preset such as iPhone 13. Confirm all of the following at a narrow viewport:

1. Briefly tap one of your cards. The Play/Discard menu opens.
2. Press the same card without moving for about half a second. Its clue tooltip opens, and lifting the finger does not open Play/Discard. Tapping elsewhere dismisses the tooltip.
3. Drag a card horizontally through the ordered upper zone. The neighboring cards make room, and the new order remains after reloading.
4. Drag a card into the lower zone. It follows the finger freely, remains bound to the player's workspace, and its position remains after reloading.
5. Repeat a mouse drag after the touch checks. Desktop dragging and hover-to-view-clues still work.

For browser automation, create a Chromium context with `hasTouch: true`. A viewport preset alone does not do that. Taps can use Playwright's `page.touchscreen.tap`; hold and drag sequences should use a Chrome DevTools Protocol session with `Input.dispatchTouchEvent` for `touchStart`, one or more `touchMove` events, and `touchEnd`. Assert the final card positions after a reload so the test proves the server received the drop rather than merely seeing the client-side drag preview.
