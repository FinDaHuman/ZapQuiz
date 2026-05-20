# ⚡ ZapQuiz

ZapQuiz is a highly robust, server-authoritative, real-time asynchronous quiz platform (a hybrid of Kahoot! and Blooket) built with a focus on fairness, speed, and anti-cheat protection. 

The platform supports an asynchronous, player-paced gameplay loop with a single centralized lobby, making it ideal for large-group events (100+ concurrent players) with close to zero latency.

---

## 🏗️ Architecture Overview

ZapQuiz is designed around a three-tier architecture that prioritizes real-time performance and absolute security:

```
┌────────────────────────┐         ┌────────────────────────┐         ┌────────────────────────┐
│                        │         │   Node.js Backend      │         │     Supabase DB        │
│   Next.js 16 Client    │ ──────> │  (Express + Socket.IO) │ ──────> │  (PostgreSQL + RLS)    │
│  (Player/Host Views)   │ <────── │  (In-Memory Game Loop) │ <────── │ (Preloaded Questions)  │
│                        │         │                        │         │                        │
└────────────────────────┘         └────────────────────────┘         └────────────────────────┘
```

1. **Frontend (Next.js 16 + Socket.IO Client):** Serves the interactive Player view and the comprehensive Host Dashboard. It tracks browser actions to detect cheats and manages a persistent connection via socket events.
2. **Backend (Node.js + Express + Socket.IO):** The single source of truth. Handles the gameplay loop, verifies answers in-memory, tracks scores, monitors players, and runs as an authoritative engine. Correct answers are **never** exposed to the client.
3. **Database (Supabase PostgreSQL):** Used for cold storage. Questions are pulled *once* into server RAM at startup to eliminate DB query overhead during gameplay. Final scores are saved securely in bulk when the host concludes the game.

---

## 🌟 Core Features

### 🎮 Asynchronous Game Loop (Blooket-Style)
Players answer questions at their own individual pace rather than waiting on a global synchronized countdown. The server dispenses random questions from its pre-cached bank, resulting in zero DB sync delays and a fast, continuous flow.

### 🛡️ Authoritative Anti-Cheat Defenses
*   **Hidden Correct Answers:** The client never receives correct answers. The server evaluates all submitted options in RAM.
*   **Active Tab Monitoring:** Using the browser's Visibility and Focus APIs, the client alerts the server if a player switches tabs, opens dev tools, or unfocuses the window. A warning tag `⚠️ Tab Switched` is instantly rendered next to their name on the Host Dashboard.
*   **Session Lockouts:** Player names are checked for duplicates upon join, and answer resubmission is blocked.

### 🔄 Persistent Reconnection Handling
Players generate and store a secure UUID `playerToken` in their browser’s `localStorage` upon joining. If they refresh their page, lose network connection, or close their tab, the server automatically maps their new socket connection to their existing session, preserving their score and rank.

### 📊 Live Host Dashboard
Hosts control the gameplay flow through simple actions:
*   **Start Game:** Triggers the server to preload questions and launches the gameplay cycle.
*   **End Game:** Stops play immediately, locks submissions, and bulk-saves results to Supabase.
*   **Download CSV:** Allows immediate local export of the finalized leaderboard for further analytics.
*   **Reset Lobby:** Puts the active room back into the waiting queue.

---

## 📁 Repository Structure

```
.
├── backend/
│   ├── .env                 # Backend database keys & server port
│   ├── server.js            # Authoritative Express + Socket.IO server
│   └── package.json         # Backend dependencies
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── host/        # Host dashboard page & CSV downloaders
│   │   │   ├── play/        # Player gameplay pages (Top bar, layout, choices)
│   │   │   ├── globals.css  # Global CSS variables & styling tokens
│   │   │   └── page.tsx     # Player onboarding / name input screen
│   │   └── lib/
│   │       ├── socket.ts    # Socket.IO client singleton setup
│   │       └── supabase.ts  # Supabase client instantiation
│   └── package.json         # Frontend Next.js dependencies
├── supabase-schema.sql      # Database initialization script (PostgreSQL schema)
└── plan.md                  # Initial implementation roadmap
```

---

## 🛠️ Local Installation & Setup

### Prerequisites
*   Node.js (v18 or higher)
*   A Supabase project (for fetching questions and storing final leaderboards)

### Step 1: Database Setup
1. Open your **Supabase SQL Editor**.
2. Copy and paste the contents of `supabase-schema.sql` into the editor.
3. Run the script. This will set up the `questions`, `players`, and `quiz_state` tables, insert initial sample questions, and enable Row Level Security (RLS).

### Step 2: Configure Environment Variables
Create a `.env` file in the `backend` directory and add your Supabase credentials:
```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-secret-service-role-key
PORT=3001
```

Create a `.env.local` file in the `frontend` directory:
```env
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
```

### Step 3: Run the Backend
Navigate to the `backend` directory, install packages, and start the Socket.IO server:
```bash
cd backend
npm install
node server.js
```
The server will boot and log: `Socket.IO game server running on port 3001`.

### Step 4: Run the Frontend
Navigate to the `frontend` directory, install packages, and start the Next.js dev server:
```bash
cd ../frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the onboarding flow and access `/host` to view the control dashboard!

---

## 🔒 Security Best Practices Implemented

*   **Service Role Execution:** Database queries that fetch answers or update records bypass public tables and operate on the server using a restricted Service Role client.
*   **No Client-Side Queries:** The Next.js frontend has zero permissions to read correct answers from `questions` or directly modify database records.
*   **Input Sanitization:** Player display names are capped at 20 characters and validated before joining to block potential XSS injection attacks.
