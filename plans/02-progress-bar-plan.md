# Duck Progress Bar Plan

## Objective
Replace the live text-based leaderboard for players with a visual progress bar using a duck emoji (🦆) that tracks their progress towards a preset point goal.

## Key Files & Context
- `frontend/src/app/play/page.tsx`: Player gameplay interface.
- `backend/server.js`: Game state and scoring.

## Implementation Steps
1. **Define Progress Goal**:
   - Establish a maximum target score (e.g., 5000 points or calculated based on the number of questions). This can be sent from the backend during game start.
   
2. **Player UI Updates (`frontend/src/app/play/page.tsx`)**:
   - **Remove Leaderboard**: Delete the `<div className="mini-leaderboard">` section from the active question view. Players should no longer see the ranks of others.
   - **Add Duck Progress Bar**: 
     - Create a new horizontal progress bar component below the top bar.
     - Calculate progress percentage: `Math.min(100, (myScore / targetScore) * 100)%`.
     - Use a duck emoji `🦆` as the thumb/marker on the progress bar.
     - Add smooth CSS transitions to the left positioning of the duck so it glides forward when points are scored.
     
3. **Styling (CSS)**:
   - Design the track (e.g., a "water" colored rounded div).
   - Ensure the duck emoji is adequately sized and positioned cleanly on top of the track.

## Verification
- Verify the mini-leaderboard is completely hidden from the player view.
- Answer questions correctly and verify the duck moves forward smoothly.
- Ensure the duck does not overflow the container if the player exceeds the target score.