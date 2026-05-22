# Performance Optimization Plan (100+ Users Free Tier)

## Objective
Optimize the application architecture to reliably support 100+ concurrent users on free-tier hosting (Render for Node.js, Vercel for Next.js, Supabase for DB) by reducing server CPU spikes, minimizing broadcast payloads, and handling burst traffic efficiently.

## Key Files & Context
- `backend/server.js`: Websocket broadcasting and Supabase interactions.
- `frontend/src/app/play/page.tsx` & `host/page.tsx`: Client rendering.

## Implementation Steps
1. **Throttled State Broadcasting (`backend/server.js`)**:
   - Currently, `broadcastState()` fires on every single `submit_answer` and `tab_switched`. With 100 users clicking answers simultaneously, this causes 100+ full leaderboard broadcasts per second, freezing the Node.js event loop.
   - **Fix**: Implement a throttle or debounce mechanism. Collect state changes and broadcast the `state_update` at most once every 500ms using a `setInterval` or `lodash.throttle`.
   
2. **Payload Size Reduction**:
   - Only send necessary data in the leaderboard payload. Avoid sending full player objects. The current implementation maps it down, but we can further compress the payload (e.g., removing redundant fields or sending deltas if necessary).

3. **Database Caching & Batching**:
   - Supabase `questions` are fetched once on start (Good).
   - Supabase `upsert` on game end: 100 players means 100 rows. The current `upsert(playersToSave)` is already a single batch request, which is efficient and handles free tier limits well.
   
4. **Frontend Render Optimization (`frontend/src/app/*`)**:
   - Ensure the Next.js frontend uses `React.memo` or careful dependency arrays so the UI does not trigger a complete React tree re-render 10 times a second when the throttled leaderboard data arrives.
   - Use CSS animations for progress bars and ducks to ensure layout calculation is handled by the GPU rather than React state updates.

## Verification
- Use a simple Node.js load testing script (e.g., Artillery or a custom Socket.io script) to simulate 100 users joining and submitting answers concurrently.
- Verify Render CPU usage remains stable and broadcasts do not lag.
- Verify Supabase does not hit API rate limits on game end.