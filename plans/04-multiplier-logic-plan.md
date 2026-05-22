# Catch-Up Multiplier Logic Plan

## Objective
Implement a streak/multiplier system that helps lower-ranked players catch up, limits the snowball effect for top players, and penalizes players who alt-tab. This multiplier will be visualised as a trail behind the duck progress bar.

## Key Files & Context
- `backend/server.js`: Player state, scoring logic, alt-tab handling.
- `frontend/src/app/play/page.tsx`: Duck progress bar UI, visibility listener.

## Implementation Steps
1. **Backend State Update (`backend/server.js`)**:
   - Update `freshPlayerTracking()` to include `multiplier: 1` and `streak: 0`.
   - **Alt-Tab Penalty**: In the `tab_switched` event, reset the player's multiplier to 1 and streak to 0. (They still keep their base points, but lose momentum).
   
2. **Dynamic Scoring Logic**:
   - In `submit_answer`, calculate rank dynamically before awarding points.
   - If player is in the bottom 50% of the leaderboard, they gain multiplier stacks faster for correct answers (catch-up mechanic).
   - If a player is in 1st place, limit their max multiplier (anti-snowball).
   - Apply multiplier to the base score (e.g., `baseScore + (bonus * multiplier)`).
   - Reset streak/multiplier on incorrect answers.
   - Broadcast the `multiplier` value in the `getLeaderboard()` mapping.

3. **Frontend Visualization (`frontend/src/app/play/page.tsx`)**:
   - Read `myPlayer.multiplier` from the synced leaderboard state.
   - Add a CSS trail effect (e.g., flame emojis 🔥, wind dashes 💨, or glowing box-shadow) behind the duck emoji on the progress bar.
   - The intensity or length of the trail scales with the multiplier value (e.g., no trail at 1x, small trail at 2x, huge glowing trail at 5x+).
   - Do not explicitly show the numeric multiplier to the user, only the visual trail.

## Verification
- Test correct answers to build a multiplier. Verify the visual trail appears behind the duck.
- Alt-tab out of the window. Verify the trail disappears immediately.
- Test with two accounts: make one lag behind. Verify the trailing account catches up faster on correct answers.