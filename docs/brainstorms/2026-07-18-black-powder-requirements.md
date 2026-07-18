---
date: 2026-07-18
topic: black-powder
---

# Black Powder Game Mode

## Problem Frame

Hanabi supports the base five-color game, a sixth ordinary color, and a decoy-rainbow variant, but it cannot host the published Black Powder expansion. Players need a selectable mode that implements the official reversed black firework without weakening the existing server-authoritative clue and play rules.

---

## Key Flows

- F1. Start a Black Powder game
  - **Trigger:** A player selects Black Powder in the setup lobby and starts the game.
  - **Steps:** The server accepts the mode, creates the standard 50-tile deck plus the 10-tile reversed black suit, deals the normal hand size, and publishes the game state.
  - **Outcome:** All players see a 60-tile Black Powder game with a distinct sixth firework.
  - **Covered by:** R1, R2, R7
- F2. Play and clue black tiles
  - **Trigger:** A player interacts with a visible black tile or plays one from their hand.
  - **Steps:** The UI offers rank clues but no black color clue; rank clues include every matching black and colored tile; black tiles play from 5 down to 1; completing the black stack restores one clue token within the normal cap.
  - **Outcome:** The expansion follows the published play and information rules.
  - **Covered by:** R3, R4, R5

---

## Requirements

**Mode and deck**

- R1. The lobby must offer a Black Powder rule set without changing the defaults or behavior of existing modes.
- R2. Black Powder must use the five standard suits plus 10 black tiles distributed as three 5s, two 4s, two 3s, two 2s, and one 1.

**Gameplay**

- R3. The black firework must accept tiles only in descending order from 5 through 1; other suits remain ascending.
- R4. Black tiles must be colorless for clue purposes: no black color clue may be offered or accepted, and ordinary color clues must not select black tiles.
- R5. Rank clues must select matching black tiles along with matching colored tiles, and playing black 1 to complete the firework must restore one clue token within the normal cap.
- R6. A complete Black Powder game requires all five ordinary fireworks and the black firework, while final scoring remains capped at 25: ordinary played tiles minus one point for each missing black tile.

**Presentation and compatibility**

- R7. Visible black tiles and the descending black firework must be visually distinct from hidden tiles and readable at both supported tile sizes.
- R8. Existing saved games and all existing rule sets must retain their current serialized shape and runtime behavior.
- R9. The lobby must also offer a combined Decoy Rainbow + Black Powder rule set with all seven fireworks and both expansions' clue behavior.

---

## Acceptance Examples

- AE1. **Covers R2.** Given a new Black Powder game, its deck contains 60 tiles and black multiplicities of one 1, two each of 2–4, and three 5s.
- AE2. **Covers R3, R5.** Given an empty black firework, black 5 plays successfully; black 4 does not play first; after black 5–2 are present, black 1 completes the firework and restores a clue when fewer than eight remain.
- AE3. **Covers R4, R5.** Given a hand containing red 3 and black 3, a rank-3 clue touches both, a red clue touches only red 3, and a black color clue is rejected.
- AE4. **Covers R6.** Given 18 ordinary played tiles and black 5–3 played, the displayed final score is 16 out of 25.
- AE5. **Covers R9.** Given a combined game, the deck contains 70 tiles; rainbow tiles match every standard color clue, black tiles match no color clue, completion requires all 35 positions, and the maximum score is 30.

---

## Success Criteria

- Players can select, play, clue, finish, and score a Black Powder game according to the published expansion rules.
- Automated tests prove deck composition, reversed play, clue restrictions, completion reward, and special scoring; browser verification proves the new tiles and stack are legible.

---

## Scope Boundaries

- Support Black Powder alone or combined with the existing Decoy Rainbow variant; do not add sixth-color, Avalanche, or other combinations.
- Do not add optional digital-platform hand-size modifiers or community clue conventions.
- Do not redesign the lobby or board beyond the styling and interaction changes needed for Black Powder.

---

## Key Decisions

- Model the supported Black Powder configurations as explicit rule sets in the existing selector.
- Use the published 10-tile reversed distribution and the official 25-point penalty scoring, not community singleton or 30-point variants.
- Keep legality server-authoritative; the UI removes the illegal affordance but is not the enforcement boundary.

---

## Dependencies / Assumptions

- Rules are sourced from the official R&R Games expansion leaflet and original publisher Cocktail Games materials.
- Existing normal hand sizes, fuse rules, clue-token cap, and final-round behavior remain unchanged.

---

## Next Steps

-> Implement and verify the mode across shared state, server rules, and the existing React presentation.
