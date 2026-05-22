# ZapQuiz v0.0.2 Beta — Duck Race Realtime Quiz System

## Overview

This document defines the complete gameplay, scoring, anti-cheat, animation, networking, and performance architecture for ZapQuiz v0.0.2 Beta.

The game is a realtime multiplayer quiz game inspired by Blooket/Kahoot but redesigned around a “Duck Race” mechanic.

Players answer questions to move their duck toward the finish line.

The system must support:

* 100 concurrent players
* Vercel free tier
* Render free tier
* Supabase free tier
* low latency
* mobile-first UI
* lightweight rendering
* anti-cheat logic
* realtime leaderboard
* smooth race animations

---

# Core Gameplay

## Objective

Players race ducks toward a finish line.

Correct answers increase distance.

Faster answers give bonuses.

Streaks provide multipliers.

The game ends when:

* a player reaches the finish line
  OR
* the host timer ends

---

# Race Constants

```ts
const FINISH_DISTANCE = 1000

const BASE_DISTANCE = 40

const MAX_SPEED_BONUS = 20
```

---

# Player State

```ts
type Player = {
  id: string

  name: string

  totalDistance: number

  score: number

  streak: number

  multiplier: number

  correctAnswers: number

  wrongAnswers: number

  avgResponseTime: number

  tabSwitchCount: number

  isTabFocused: boolean

  finished: boolean

  finishTime?: number

  lastAnswerTime?: number
}
```

---

# Distance System

## Correct Answer

Correct answers move the duck forward.

Formula:

```ts
distanceGain =
(BASE_DISTANCE * multiplier)
+ speedBonus
```

---

# Wrong Answer

Wrong answers:

```ts
distanceGain = 0
```

and:

```ts
streak = 0
```

---

# Speed Bonus

## Formula

```ts
speedRatio = 1 - (responseTime / questionTimeLimit)
```

Clamp:

```ts
speedRatio = Math.max(0, Math.min(1, speedRatio))
```

Bonus:

```ts
speedBonus = speedRatio * MAX_SPEED_BONUS
```

---

# Example

Question limit:

```ts
15 seconds
```

Player answers in:

```ts
3 seconds
```

Calculation:

```ts
speedRatio = 1 - (3 / 15)
           = 0.8

speedBonus = 0.8 * 20
           = 16
```

---

# Streak System

## Rules

Correct answer:

```ts
streak += 1
```

Wrong answer:

```ts
streak = 0
```

---

# Multiplier System

## Multiplier Table

| Streak | Multiplier |
| ------ | ---------- |
| 0-1    | x1.0       |
| 2      | x1.1       |
| 3      | x1.2       |
| 4      | x1.3       |
| 5+     | x1.5       |

---

# IMPORTANT

Multiplier ONLY applies to:

```ts
BASE_DISTANCE
```

Multiplier does NOT apply to:

* speed bonus
* catch-up bonus

---

# Example Calculation

Player:

* streak = 4
* multiplier = x1.3
* speed bonus = 17

Calculation:

```ts
distance =
(40 * 1.3)
+ 17

distance =
52 + 17

distance = 69
```

---

# Rubber Band System (Anti Snowball)

The game should remain competitive.

Players behind should receive small catch-up bonuses.

---

# Catch-Up Bonus

If player rank is below top 50%:

```ts
distance *= 1.05
```

If player rank is below top 75%:

```ts
distance *= 1.10
```

---

# Leader Nerf

Top 1 player:

```ts
speedBonus *= 0.95
```

Top 2-5:

```ts
speedBonus *= 0.98
```

Do NOT make this too aggressive.

The effect should be subtle.

---

# Tab Switch Anti-Cheat

## Goal

Prevent players from:

* googling answers
* switching tabs repeatedly
* using AI during questions

WITHOUT being too punishing.

---

# Frontend Detection

```js
document.addEventListener("visibilitychange", () => {
  socket.emit("tab_visibility", {
    hidden: document.hidden
  })
})
```

---

# Server State

```ts
isTabFocused: boolean
```

---

# Rules

If player changes tab during question:

DISABLE multiplier for current answer.

The player still receives:

* base distance
* speed bonus

BUT:

* no multiplier

---

# Example

Normal:

```ts
40 * 1.5 + 16
= 76
```

Tab switched:

```ts
40 + 16
= 56
```

---

# IMPORTANT

Do NOT reset streak.

Reason:

* accidental alt-tab
* mobile notifications
* browser focus issues

---

# Optional Additional Penalty

If hidden longer than 10 seconds:

```ts
speedBonus = Math.min(speedBonus, 5)
```

---

# AFK Detection

If player misses:

```ts
3 consecutive questions
```

Set player as AFK.

---

# AFK Visual

Host screen:

* duck becomes dim
* “Zzz” icon appears

---

# Finish Logic

Game ends when:

```ts
player.totalDistance >= FINISH_DISTANCE
```

OR

```ts
globalTimerExpired
```

---

# Final Rankings

Sort priority:

1. Finished first
2. Furthest distance
3. Faster average response time

---

# Networking Architecture

IMPORTANT:

The server NEVER streams live positions every frame.

The server ONLY sends:

* answer results
* distance updates
* leaderboard snapshots

---

# DO NOT DO THIS

```ts
emit position every frame
```

---

# DO THIS INSTEAD

```json
{
  "type": "answer_result",
  "playerId": "abc",
  "distanceDelta": 68,
  "totalDistance": 530
}
```

---

# Snapshot Frequency

Recommended:

```ts
2 updates per second
```

Meaning:

```ts
every 500ms
```

This is enough for smooth animation.

---

# Animation Architecture

## IMPORTANT

Animation is FAKE on the client.

The server only sends:

* target distance
* target rank

The client interpolates movement.

---

# Client Animation

Use:

```css
transform: translate3d(x,0,0)
```

DO NOT use:

* left
* top

Reason:

* GPU accelerated
* smoother
* less layout recalculation

---

# Animation Interpolation

When new position arrives:

```ts
currentX -> targetX
```

Animate over:

```ts
300ms - 500ms
```

---

# Player UI

## Goals

* compact
* mobile friendly
* does not block question area

---

# Player Layout

```text
Question 5/20

🐤────────────🏁
        64%

⏱ 12s
```

Height target:

```ts
60px - 80px
```

---

# Player Animation

Correct answer:

* duck boost forward
* small splash particles

Wrong answer:

* duck shake slightly

Streak:

* glowing trail

---

# Host Screen

## IMPORTANT

DO NOT render 100 full animated ducks.

That will lag on free-tier hosting.

---

# Correct Strategy

Animate ONLY:

* top 8 to top 10 players

All others:

* compact leaderboard text

---

# Host Layout

LEFT:

* animated duck race

RIGHT:

* compact leaderboard

---

# Example

```text
TOP 10 LIVE RACE

🐤 Finn
══════════════🏁

🐸 Alex
════════════🏁

🐱 Minh
══════════🏁
```

Leaderboard:

```text
11. Nam (+530m)
12. Long (+522m)
13. Hoa (+519m)
```

---

# Duck Animation

DO NOT use GIFs.

Use:

* sprite sheets
* CSS steps()

Example:

```css
animation: duckRun 0.5s steps(4) infinite;
```

---

# Background Animation

DO NOT simulate real water physics.

Instead:

* scrolling background texture
* parallax clouds
* lightweight particles

---

# Rendering Strategy

## Recommended

Player screen:

* React
* CSS transforms

Host screen:

* React
* lightweight CSS transforms

Optional:

* PixiJS

NOT required for beta.

---

# Performance Rules

DO NOT use:

* physics engines
* heavy SVG animation
* full canvas redraws
* GIF animations
* frame-by-frame websocket updates

---

# Recommended Technologies

Frontend:

* Next.js
* React
* TailwindCSS

Realtime:

* Supabase Realtime
  OR
* Socket.IO on Render

Database:

* Supabase PostgreSQL

Hosting:

* Vercel frontend
* Render websocket server

---

# Recommended Server Architecture

## Frontend (Vercel)

Handles:

* player UI
* host UI
* animations
* rendering

---

# Realtime Server (Render)

Handles:

* websocket connections
* room state
* scoring
* ranking
* anti-cheat
* authoritative game state

---

# Database (Supabase)

Stores:

* game sessions
* question sets
* final scores
* analytics

NOT realtime movement.

---

# IMPORTANT

Server must be authoritative.

The client NEVER calculates score.

The client ONLY sends:

```json
{
  "answerIndex": 2
}
```

---

# Response Time Anti-Cheat

DO NOT trust client timestamps.

Server stores:

```ts
questionStartTimestamp
```

Response time:

```ts
Date.now() - questionStartTimestamp
```

---

# Socket Events

## Client → Server

```ts
player_answer
tab_visibility
join_game
leave_game
```

---

# Server → Client

```ts
question_start
question_end
answer_result
race_snapshot
leaderboard_update
game_end
```

---

# Realtime Optimization

## One Socket Room Per Game

Example:

```ts
game:ABC123
```

---

# Traffic Estimate

100 players
20 questions
~200 bytes per answer

Total:

```ts
100 * 20 * 200
= 400KB
```

Very manageable on free tier.

---

# Final Stretch Mode

If player distance exceeds:

```ts
850
```

Enable:

* glowing finish line
* intensified music
* screen shake
* “FINAL STRETCH” banner

---

# Philosophy

This is NOT a racing simulator.

This is a realtime quiz game with racing visuals.

The goal is:

* excitement
* clarity
* responsiveness
* lightweight performance

Fake everything possible.

Do NOT simulate real physics.

Prioritize:

* responsiveness
* smoothness
* scalability
* simplicity

---

# Recommended Beta Scope

Version 0.0.2 should ONLY include:

* duck race
* score system
* streaks
* multipliers
* leaderboard
* tab anti-cheat
* top-10 host animation
* compact player race bar
* final stretch effects

DO NOT build:

* cosmetics
* inventory
* physics
* custom maps
* advanced particles
* user accounts
* matchmaking

Keep the beta lightweight and stable.
