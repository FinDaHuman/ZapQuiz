# Master Implementation Plan: Kahoot Clone Features

## Objective
Implement five major features and optimizations (Timer, Duck Progress Bar, Host Leaderboard, Catch-Up Multiplier, and Scalability Optimization) while ensuring they do not conflict.

## Conflict Resolution & Architecture
- **State Modifications (`server.js`)**: Features 01 (Timer), 04 (Multiplier), and 05 (Optimization) all modify `gameState` and broadcasting. To prevent conflicts, we will first implement the throttling optimization, ensuring any subsequent state additions (like `endTime` and `multiplier`) are broadcasted efficiently.
- **Frontend Player UI (`play/page.tsx`)**: Features 02 (Progress Bar) and 04 (Multiplier Trail) both modify the player view. They will be integrated sequentially: the duck progress bar will be built first, followed by the trailing multiplier effect applied to the duck.
- **Frontend Host UI (`host/page.tsx`)**: Features 01 (Timer) and 03 (Progress Bar Leaderboard) both update the host view but in separate visual areas (top bar vs. leaderboard list), avoiding UI conflicts.

## Implementation Order

### Phase 1: Foundation & Optimization (Feature 05)
- **Goal**: Support 100+ concurrent users without freezing the server.
- **Backend**: Implement state broadcast throttling (e.g., `lodash.throttle` or `setInterval` every 500ms) in `server.js`.
- **Backend**: Compress `getLeaderboard()` payload.
- **Frontend**: Ensure React components (`host/page.tsx`, `play/page.tsx`) do not trigger massive re-renders on every throttled update.

### Phase 2: Global Timer (Feature 01)
- **Goal**: Synchronized countdown timer for host and players.
- **Backend**: Add `endTime` to `gameState` when the game starts. Check `Date.now() >= endTime` to auto-end the game.
- **Frontend**: Add a 1-second `setInterval` in both host and player UIs to calculate and display the remaining time.

### Phase 3: Catch-Up Multiplier & Alt-Tab Penalty (Feature 04 - Backend Logic)
- **Goal**: Limit top player snowballing and penalize tab-switching.
- **Backend**: Add `multiplier` state to `freshPlayerTracking()`.
- **Backend**: Update `submit_answer` to apply multiplier based on relative rank (bottom 50% gain multiplier faster).
- **Backend**: Update `tab_switched` to reset the multiplier to 1 (retaining points).

### Phase 4: Player Duck Progress Bar & Multiplier Trail (Feature 02 & Feature 04 - Frontend)
- **Goal**: Replace the player leaderboard with a visual goal-oriented duck.
- **Frontend (`play/page.tsx`)**: Remove the mini-leaderboard.
- **Frontend (`play/page.tsx`)**: Add a horizontal track with a `🦆` emoji representing the player's percentage towards a `targetScore`.
- **Frontend (`play/page.tsx`)**: Add the visual multiplier trail (Feature 04) behind the duck based on the backend `multiplier` value.

### Phase 5: Host Live Leaderboard Progress Bars (Feature 03)
- **Goal**: Visual progress comparison on the host dashboard.
- **Frontend (`host/page.tsx`)**: Render horizontal progress bars behind the player names relative to the highest current score.
- **Frontend**: Implement smooth CSS width transitions.

## Verification & Testing
- Load test with a script simulating 100 concurrent sockets to verify Phase 1.
- Manually test host start/end and timer synchronization.
- Test 2+ player accounts simultaneously to verify catch-up multiplier calculations and visual duck trailing.
- Verify alt-tab completely drops the multiplier but maintains the score.