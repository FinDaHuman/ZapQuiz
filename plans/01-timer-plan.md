# Timer Till End Plan

## Objective
Implement a global timer that starts when the host begins the game and synchronizes across all users (host and players).

## Key Files & Context
- `backend/server.js`: Manages `gameState` and broadcasts to all clients.
- `frontend/src/app/host/page.tsx`: Host dashboard.
- `frontend/src/app/play/page.tsx`: Player interface.

## Implementation Steps
1. **Backend State Update (`backend/server.js`)**:
   - Add `endTime` to `gameState`.
   - When the host sends the `start` action, calculate `gameState.endTime = Date.now() + GAME_DURATION_MS`.
   - Update `broadcastState()` to include `endTime` in the payload.
   
2. **Frontend Synchronization**:
   - Both `host/page.tsx` and `play/page.tsx` will receive `endTime` via the `sync` and `state_update` socket events.
   - Implement a `useEffect` hook with a `setInterval` (running every 1 second) to compute the remaining time: `Math.max(0, endTime - Date.now())`.
   
3. **UI Integration**:
   - **Host UI**: Display a prominent global countdown timer in the top bar or left panel.
   - **Player UI**: Display the countdown timer in the top bar next to the player's score.
   
4. **Auto-End Game Logic**:
   - On the backend, when `Date.now() >= gameState.endTime`, automatically transition the game state to `ended` and trigger the final score broadcast and Supabase save, similar to the manual `end` host action.

## Verification
- Start the game as a host and verify the timer appears on both host and player screens.
- Verify the timer stays synchronized (within minor network latency bounds).
- Verify the game automatically ends when the timer reaches 0.