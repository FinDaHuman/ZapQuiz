# Host Live Leaderboard Progress Bars Plan

## Objective
Enhance the host's live leaderboard by visualizing player progress using comparative horizontal progress bars instead of just numerical scores.

## Key Files & Context
- `frontend/src/app/host/page.tsx`: Host dashboard UI.

## Implementation Steps
1. **Determine Relative Max Score**:
   - The progress bars should compare players to the current leader.
   - Calculate `maxScore = Math.max(...activePlayers.map(p => p.score), 1)`.

2. **Update Host UI (`frontend/src/app/host/page.tsx`)**:
   - In the `leaderboard-item` render loop, keep the player name and stats but add a progress bar background element.
   - Set the width of each player's progress bar dynamically: `width: ${(p.score / maxScore) * 100}%`.
   - Use distinct colors for the top 3 players (e.g., Gold, Silver, Bronze colored bars) and a standard color for the rest.
   
3. **Styling Tweaks**:
   - Position the progress bar visually behind the text (using `z-index` and absolute positioning) or as a clear bar below the player's name within the list item.
   - Add a CSS transition (`transition: width 0.5s ease-out`) so the bars animate smoothly as scores update live.

## Verification
- Have multiple players join and score different amounts of points.
- Verify the host screen shows animated bars representing the relative score distance between players.
- Verify the leader's bar is always 100% full.