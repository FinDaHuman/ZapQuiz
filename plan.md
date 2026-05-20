# Implementation Plan: Blooket-Style Asynchronous Quiz Platform

## Objective
Build a highly robust, server-authoritative real-time quiz platform for a single 30-minute event with 100 concurrent participants. The architecture is simplified to an asynchronous, player-paced loop (Blooket-style) with a single hardcoded lobby.

## Core Architectural Approach
*   **Live Gameplay (Socket.IO):** Handles the fast-paced, asynchronous game loop. Players fetch random questions and receive immediate feedback without relying on a global synchronized timer. Ensures zero DB-sync lag.
*   **Persistent State (Supabase):** Stores the quiz questions initially. Acts as the persistent backup for final scores when the game concludes.

## Key Technical Requirements
1.  **Asynchronous Game Loop:** Players answer questions at their own pace. There are no global timers.
2.  **No Client DB Mutations:** Clients only emit Socket.IO events. The Node server validates all inputs and calculates scores.
3.  **Reconnection Tokens:** Clients generate/store a `playerToken` in `localStorage`. The server maps this token to player state for seamless reconnects without data loss.
4.  **Preloaded Questions:** All questions are fetched from Supabase into Node.js server memory at the start of the quiz to prevent latency.
5.  **Final Persistence:** When the host clicks "End Game", the final leaderboard is automatically pushed to the Supabase database.
6.  **Results Export:** The Host Dashboard includes a feature to export the final leaderboard as a CSV file.

## Implementation Steps

### Phase 1: Backend Setup (Node.js + Socket.IO)
1.  Initialize a standalone Node.js server using Express and Socket.IO.
2.  Set up the global, in-memory state object (`gameState`).
3.  Integrate the Supabase Admin client to fetch questions securely on startup.

### Phase 2: Socket Event Handlers
1.  **Connection & Reconnection:** Accept `playerToken` on connection. Map socket IDs to existing tokens to recover state on refresh.
2.  **Host Controls:** Handlers for `host_start`, `host_end`, and `host_waiting`.
3.  **Gameplay:** 
    *   `get_question`: Sends a random question from the bank to the requesting player.
    *   `submit_answer`: Validates the answer, updates the score, and sends an immediate `answer_result` back to the player.
4.  **End Game Persistence:** Trigger `supabase.from('players').upsert()` on the `host_end` event.

### Phase 3: Frontend Refactor (Next.js + socket.io-client)
1.  Implement `socket.io-client` singleton.
2.  Update the Player view to handle the `playing` and `feedback` states (showing Correct/Incorrect popups).
3.  Update the Host Dashboard to include "Start Game", "End Game", and "Download CSV" buttons.

### Phase 4: Anti-Cheat
1.  Implement `visibilitychange` listener that emits a `tab_switched` socket event.
2.  Display a warning tag next to the player's name on the Host Dashboard.