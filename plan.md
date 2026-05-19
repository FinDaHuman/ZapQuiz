# Implementation Plan: Hybrid Architecture Kahoot Clone

## Objective
Build a highly robust, server-authoritative real-time quiz platform for a single 30-minute event with 100 concurrent participants. The architecture is simplified to a single hardcoded lobby to eliminate bugs.

## Core Architectural Pivot: Hybrid Approach
*   **Live Gameplay (Socket.IO):** Handles fast-paced game loop, authoritative timers, question broadcasts, and answer submissions. Ensures zero DB-sync lag.
*   **Persistent State (Supabase):** Stores the quiz questions and acts as the persistent backup for the final leaderboard. 

## Key Technical Requirements
1.  **Server-First Game Loop:** The Node.js server controls the state. Database propagation speed must never affect gameplay.
2.  **No Client DB Mutations:** Clients only emit Socket.IO events. The Node server validates all inputs and updates memory/DB.
3.  **Reconnection Tokens:** Clients generate/store a `playerToken` in `localStorage`. The server maps this token to player state for seamless reconnects without data loss.
4.  **Server Authoritative Timers:** Timers are NOT started locally. The server broadcasts `questionEndTime`, and clients calculate remaining time relative to the server timestamp.
5.  **Preloaded Questions:** All questions are fetched from Supabase into Node.js server memory at the start of the quiz to prevent latency during question transitions.
6.  **Hardcoded Lobby:** Single lobby instance to drastically simplify the architecture.

## Implementation Steps

### Phase 1: Backend Setup (Node.js + Socket.IO)
1.  Initialize a standalone Node.js server using Express and Socket.IO.
2.  Set up the global, in-memory state object (`gameState`).
3.  Integrate the Supabase Admin client to fetch questions securely on startup.

### Phase 2: Socket Event Handlers
1.  **Connection & Reconnection:** Accept `playerToken` on connection. Map socket IDs to existing tokens to recover state on refresh.
2.  **Host Controls:** Handlers for `host_start`, `host_next_question`, and `host_end`.
3.  **Gameplay:** Handlers for `submit_answer` and `tab_switched`. Calculate scores securely on the server based on the server timestamp.

### Phase 3: Frontend Refactor (Next.js + socket.io-client)
1.  Remove Supabase Realtime subscriptions and API routes.
2.  Implement `socket.io-client` context provider or singleton.
3.  Update the Lobby, Player, and Host views to listen to Socket events (`state_update`, `question_start`, `leaderboard_update`).

### Phase 4: Anti-Cheat & Timers
1.  Implement `visibilitychange` listener that emits a `tab_switched` socket event.
2.  Implement a client-side sync timer that strictly counts down to the `questionEndTime` broadcast by the server.