# UI/UX Redesign Plan — Kahoot-Style Anti-Cheat Quiz Platform

## Overview

This document instructs an AI agent to completely redesign the frontend of the quiz platform
located in `frontend/src/`. The current design uses a flat teal-blue gradient with basic white
cards and minimal visual personality. The goal is a **bright, vibrant, joyful aesthetic** that
feels welcoming, playful, and energetic — like a modern ed-tech product (think Duolingo meets
Kahoot meets Notion's colorful illustrations).

Read `frontend/src/app/globals.css`, `frontend/src/app/page.tsx`,
`frontend/src/app/play/page.tsx`, and `frontend/src/app/host/page.tsx` before touching
anything. Preserve all socket logic, routing, and state management exactly as-is.
Only change CSS, JSX structure/layout, and visual assets.

---

## Aesthetic Direction — "Sunshine Arcade"

Commit fully to a **bright, warm, ultra-colorful** aesthetic:

- **Mood**: Playful, energetic, inclusive. Like a Saturday morning cartoon crossed with a
  premium mobile game. Everyone feels welcome — students, teachers, competitive players alike.
- **Background**: A rich, animated gradient that slowly shifts between warm coral, golden
  yellow, and sky blue. NOT a flat color. Use `background-size: 300% 300%` with a CSS
  keyframe to animate the gradient position, creating a living, breathing canvas.
- **Primary palette**:
  - Background gradient: `#FF6B6B` → `#FFE66D` → `#4ECDC4` → `#A8E6CF`
  - Primary action: `#FF6B6B` (coral red) — buttons, highlights
  - Secondary action: `#FFE66D` (sunny yellow) — accents, score badges
  - Tertiary: `#4ECDC4` (mint teal) — success states, progress
  - Purple pop: `#C77DFF` — rank badges, special labels
  - Deep navy text: `#1A1A2E` — all body text, high contrast on light surfaces
- **Surfaces**: Bright **white cards** with generous border-radius (24px), thick colorful
  left-border accents, and soft multi-layered shadows:
  `box-shadow: 0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)`
  Cards should feel like physical tiles — light, solid, trustworthy.
- **Typography**: Use Google Fonts. Pair **"Nunito"** (headings — rounded, friendly, joyful)
  with **"Plus Jakarta Sans"** (body/UI — modern, readable, slightly geometric).
- **Borders & Details**: Use thick `4px` colored borders on interactive elements. Buttons have
  a "3D press" effect using `box-shadow: 0 6px 0 darkerShade` that collapses on `:active`.
  Answer buttons each have a distinctive thick bottom shadow simulating a physical key press.
- **Illustrations & Decorations**: Bright confetti-style floating shapes in the background
  (circles, stars, zigzags) implemented as pure CSS pseudo-elements and `::before`/`::after`
  with `animation: float` keyframes.

---

## Image & Asset Strategy

### ✅ Use Images from the Internet via Direct URL

The agent **may and should** reference images hosted publicly on the internet directly in
`<img src="...">` tags or CSS `background-image: url(...)`. No download needed — just use the
URL directly in the code.

**Approved royalty-free image sources:**
- `https://images.unsplash.com/` — quality photos (append `?auto=format&fit=crop&w=800&q=80`)
- `https://picsum.photos/` — simple placeholder images

**Page-specific image recommendations:**

| Page | Image usage |
|---|---|
| Landing (`/`) | Floating decorative blob shapes — implement as CSS radial-gradient divs, no external image needed. Optionally add a cheerful classroom/team photo: `https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=800&q=80` as a small rounded inset. |
| Waiting room | Fun "get ready" crowd energy: `https://images.unsplash.com/photo-1511988617509-a57c8a288659?auto=format&fit=crop&w=800&q=80` — use as a rounded thumbnail, not a full background. |
| Ended / Results | Celebration: `https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=800&q=80` (confetti/party) — small decorative element. |

**Application rule for all images:**
- Use as **small decorative accents** (max 120×120px rounded thumbnails), never full-page
  backgrounds that compete with the colorful gradient canvas.
- Apply `border-radius: 16px` and a `box-shadow` to make them feel like stickers or cards.
- Keep `alt` text descriptive.

### ✅ Create Inline SVG Assets

For icons, the logo, and decorative elements — write SVG code directly inline.
No external icon library needed.

**Assets to create as inline SVGs:**

1. **Platform logo** — Bold lightning bolt with a smiley star inside, using coral-to-yellow
   gradient. Render next to the "QuizBlitz" wordmark on all pages.

```jsx
const Logo = () => (
  <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
    <circle cx="22" cy="22" r="22" fill="url(#logoGrad)"/>
    <path d="M26 6L14 24h10l-4 14 16-20H24l4-12z" fill="white"/>
    <defs>
      <linearGradient id="logoGrad" x1="0" y1="0" x2="44" y2="44">
        <stop offset="0%" stopColor="#FF6B6B"/>
        <stop offset="100%" stopColor="#FFE66D"/>
      </linearGradient>
    </defs>
  </svg>
);
```

2. **Answer shape icons** — Place in the top-left of each answer button (matching Kahoot's
   triangle/diamond/circle/square motif but rounder and friendlier):
   - Button 0 (red): filled triangle `▲` — `#FF6B6B`
   - Button 1 (blue): filled diamond `◆` — `#4D96FF`
   - Button 2 (yellow): filled circle `●` — `#FFE66D`
   - Button 3 (green): filled square `■` — `#06D6A0`
   Render each as a 28×28 SVG with white fill inside a semi-transparent colored pill.

3. **Trophy SVG** — Gold gradient cup for rank #1 on leaderboard.
4. **Star burst SVG** — Decorative 8-point star for score badges.
5. **Floating background shapes** — Pure CSS: large, slow-rotating, semi-transparent colored
   circles/blobs positioned with `position: fixed` and `z-index: -1`.

---

## Background Animation

Add this CSS to create a living, animated gradient background on `body`:

```css
body {
  background: linear-gradient(-45deg, #FF6B6B, #FFE66D, #4ECDC4, #C77DFF, #4D96FF);
  background-size: 400% 400%;
  animation: gradientShift 12s ease infinite;
  min-height: 100vh;
}

@keyframes gradientShift {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
```

Also add floating decorative blobs:

```css
body::before, body::after {
  content: '';
  position: fixed;
  border-radius: 50%;
  z-index: 0;
  pointer-events: none;
  opacity: 0.18;
}
body::before {
  width: 500px; height: 500px;
  background: #fff;
  top: -100px; left: -100px;
  animation: floatBlob 14s ease-in-out infinite;
}
body::after {
  width: 350px; height: 350px;
  background: #FFE66D;
  bottom: -80px; right: -80px;
  animation: floatBlob 10s ease-in-out infinite reverse;
}
@keyframes floatBlob {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50%       { transform: translate(30px, 20px) scale(1.08); }
}
```

---

## Page-by-Page Redesign Instructions

### 1. Global Layout (`globals.css` + `layout.tsx`)

**`layout.tsx` changes:**
- Add Google Fonts link for Nunito + Plus Jakarta Sans.
- Set `<body>` to animated gradient (see above).
- All child content sits on top of the gradient via `position: relative; z-index: 1`.

**`globals.css` complete rewrite rules:**

```css
:root {
  --bg-gradient: linear-gradient(-45deg, #FF6B6B, #FFE66D, #4ECDC4, #C77DFF, #4D96FF);
  --card:         #FFFFFF;
  --card-shadow:  0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06);
  --text:         #1A1A2E;
  --text-muted:   #6B7280;
  --primary:      #FF6B6B;
  --primary-dark: #E85555;
  --yellow:       #FFD60A;
  --teal:         #4ECDC4;
  --purple:       #C77DFF;
  --blue:         #4D96FF;
  --green:        #06D6A0;
  --radius-card:  24px;
  --radius-btn:   14px;
  --font-display: 'Nunito', sans-serif;
  --font-body:    'Plus Jakarta Sans', sans-serif;
}
```

**.center-card redesign:**
```css
.center-card {
  background: var(--card);
  border-radius: var(--radius-card);
  box-shadow: var(--card-shadow);
  padding: 2.5rem;
  max-width: 460px;
  margin: 8vh auto;
  position: relative;
  overflow: hidden;
}
/* Rainbow top stripe */
.center-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 6px;
  background: linear-gradient(90deg, #FF6B6B, #FFE66D, #4ECDC4, #C77DFF);
  border-radius: var(--radius-card) var(--radius-card) 0 0;
}
```

**.btn 3D press redesign:**
```css
.btn {
  border-radius: var(--radius-btn);
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 1.1rem;
  border: none;
  padding: 1rem 1.5rem;
  width: 100%;
  cursor: pointer;
  transition: transform 0.1s, box-shadow 0.1s;
  letter-spacing: 0.3px;
}
.btn-primary {
  background: #FF6B6B;
  color: white;
  box-shadow: 0 6px 0 #C94E4E;
}
.btn-primary:hover  { filter: brightness(1.05); }
.btn-primary:active { transform: translateY(5px); box-shadow: 0 1px 0 #C94E4E; }
```

**.input-field redesign:**
```css
.input-field {
  background: #F9FAFB;
  border: 3px solid #E5E7EB;
  border-radius: 14px;
  padding: 1rem 1.2rem;
  font-family: var(--font-body);
  font-size: 1.1rem;
  color: var(--text);
  width: 100%;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.input-field:focus {
  outline: none;
  border-color: #FF6B6B;
  box-shadow: 0 0 0 4px rgba(255,107,107,0.15);
}
```

**Answer buttons (.choice-btn) redesign:**
```css
.choice-btn {
  border-radius: 18px;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 1.3rem;
  color: white;
  border: none;
  padding: 2.5rem 1.2rem 2rem;
  cursor: pointer;
  position: relative;
  transition: transform 0.12s, box-shadow 0.12s, filter 0.2s;
  text-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
.color-0 { background:#FF6B6B; box-shadow: 0 8px 0 #C94E4E; }
.color-1 { background:#4D96FF; box-shadow: 0 8px 0 #2C72D6; }
.color-2 { background:#FFD60A; box-shadow: 0 8px 0 #C9A800; color: #1A1A2E; text-shadow:none; }
.color-3 { background:#06D6A0; box-shadow: 0 8px 0 #04A07A; }
.choice-btn:hover  { filter: brightness(1.06); transform: translateY(-2px); }
.choice-btn:active { transform: translateY(8px); box-shadow: 0 0px 0 transparent; }
```

**Leaderboard rows redesign:**
```css
.leaderboard-item {
  background: white;
  border-radius: 14px;
  padding: 1rem 1.5rem;
  margin-bottom: 0.75rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: var(--font-body);
  font-weight: 700;
  box-shadow: 0 3px 12px rgba(0,0,0,0.07);
  border-left: 5px solid var(--primary);
  animation: slideInRow 0.3s ease both;
  animation-delay: calc(var(--i, 0) * 0.06s);
}
@keyframes slideInRow {
  from { opacity: 0; transform: translateX(-16px); }
  to   { opacity: 1; transform: translateX(0); }
}
```

---

### 2. Landing Page (`page.tsx`)

**Layout — bright and welcoming:**
- Animated gradient background (body CSS handles this).
- White card centered with rainbow top stripe.
- Logo SVG + "QuizBlitz" in Nunito Black, coral gradient text.
- Tagline: "Answer fast. Score big. Win everything." in Plus Jakarta Sans, muted grey.
- Large friendly emoji placeholder or small Unsplash thumbnail (rounded, 80px, right-floated).
- Name input with emoji prefix `🎮` inside the field placeholder.
- "LET'S GO! →" big coral button.
- Below card: small "Hosting a game?" link in white text.

**Floating confetti shapes around the card:**
```css
.confetti-dot {
  position: fixed;
  border-radius: 50%;
  pointer-events: none;
  animation: floatConfetti linear infinite;
  z-index: 0;
}
@keyframes floatConfetti {
  0%   { transform: translateY(100vh) rotate(0deg); opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { transform: translateY(-100px) rotate(720deg); opacity: 0; }
}
```
Generate 8–12 `.confetti-dot` divs in JSX with different sizes (8–20px), colors, left
positions (random % via inline style), and animation durations (8s–18s). Colors: coral,
yellow, teal, purple, blue, green — all the palette colors.

---

### 3. Waiting Room (`play/page.tsx` — `status === 'waiting'`)

**Layout:**
- White card, centered, rainbow top stripe.
- Big animated hourglass or waving hand emoji (large, `font-size: 4rem`) that bounces:
  ```css
  @keyframes bounce {
    0%,100% { transform: translateY(0); }
    50%      { transform: translateY(-12px); }
  }
  ```
- "You're in, **[PlayerName]**! 🎉" heading in Nunito Black.
- Connected players count shown as a colorful pill badge:
  `background: #FFE66D; color: #1A1A2E; border-radius: 999px; padding: 0.3rem 1rem;`
- Row of player avatar bubbles — colored circles with initials (use leaderboard data,
  render up to 8 bubbles, remainder shown as "+N more").
- "Waiting for host to start…" with 3 animated pulsing dots in coral.

---

### 4. Play Page — Active Question (`play/page.tsx` — `status === 'running'`)

**Top bar redesign (bright, not dark):**
- White card strip, `border-radius: 16px`, colorful shadow.
- Left: Logo + player name.
- Center: Question progress (e.g. a colored pill "Question X").
- Right: Score with star icon, large Nunito Black number in coral.

**Progress bar:**
- Tall `12px` bar, coral gradient fill, white background track.
- Rounded caps (`border-radius: 999px`).
- Animated shimmer on the fill: `background: linear-gradient(90deg, #FF6B6B, #FFE66D, #FF6B6B)` with `background-size: 200%` and scroll animation.

**Question card:**
- White card, rainbow top stripe, large question text in Plus Jakarta Sans Bold.
- Feedback zone: colorful inline chips.
  - Correct: `background: #D1FAE5; color: #065F46; border: 2px solid #06D6A0`
  - Wrong: `background: #FEE2E2; color: #991B1B; border: 2px solid #FF6B6B`

**Answer buttons:**
- 2×2 grid as before, with redesigned 3D press effect.
- Each button shows its shape icon SVG (triangle/diamond/circle/square) top-left,
  letter label (A/B/C/D) top-right in a white pill badge.
- Correct answer revealed: white checkmark overlay, brightness boost, bounce animation.
- Wrong answers: `filter: grayscale(0.6) opacity(0.5)`.

**Mini leaderboard sidebar:**
- White card, `border-left: 5px solid #FF6B6B`.
- "🏆 Leaderboard" header in Nunito Black.
- Rows: white background, colored rank numbers, coral score values.
- Your row: yellow highlight background `#FFFBEB`, purple left border.

---

### 5. Ended State (`play/page.tsx` — `status === 'ended'`)

**Layout:**
- White card, generous padding.
- Big "🏁 GAME OVER!" heading — Nunito Black, coral.
- Player rank displayed as a huge colorful badge:
  - `#1` → gold background `#FFD60A`, big trophy emoji, "CHAMPION!" text
  - `#2–3` → silver/bronze backgrounds
  - `#4+` → teal background, "Well played!" text
- Final score number animates up using a CSS counter trick or simple state interval.
- Full results leaderboard with staggered slide-in rows.
- Confetti burst (same floating confetti dots from landing, but triggered on mount).

---

### 6. Host Dashboard (`host/page.tsx`)

**Layout — bright two-column:**
- Left panel (280px): White card, tall, sticky.
- Right panel (flex-1): Leaderboard card.

**Left panel:**
- Rainbow top stripe + logo + "HOST PANEL" title in Nunito Black.
- Status badge pill — pulsing:
  - Waiting: `background: #FEF3C7; color: #92400E` + amber dot
  - Running: `background: #D1FAE5; color: #065F46` + green pulsing dot
  - Ended: `background: #F3F4F6; color: #374151` + grey dot
- Stacked action buttons with 3D press effect (full color, not ghost):
  - START → coral `#FF6B6B`
  - END → soft red `#EF4444`
  - RESET → teal outline button
  - EXPORT CSV → yellow `#FFD60A`, dark text
- Stats row at bottom of left panel: small pills for "Players", "Avg Score", "Flagged" counts.

**Right panel — leaderboard:**
- White card, rainbow top stripe.
- "🏆 Live Leaderboard" header.
- Each row is a `leaderboard-item` with:
  - Rank medal (gold/silver/bronze SVG or emoji) for top 3.
  - Player name in Plus Jakarta Sans Bold.
  - Score in Nunito Black, coral color.
  - `⚠️ Tab Switch` badge — small red pill — only if `outTabbed === true`.
  - `animation-delay` stagger via CSS custom property `--i`.

---

## Font Loading (add to `layout.tsx`)

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
<link
  href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;700&display=swap"
  rel="stylesheet"
/>
```

---

## New CSS Animations to Add

```css
/* Score popup when correct */
@keyframes scorePop {
  0%   { transform: scale(0.5); opacity: 0; }
  60%  { transform: scale(1.25); }
  100% { transform: scale(1);   opacity: 1; }
}

/* Pulsing status dot */
@keyframes statusPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.5; transform: scale(0.85); }
}

/* Bounce for waiting emoji */
@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50%       { transform: translateY(-14px); }
}

/* Shimmer on progress bar */
@keyframes shimmer {
  0%   { background-position: 200% center; }
  100% { background-position: -200% center; }
}

/* Staggered row slide-in */
@keyframes slideInRow {
  from { opacity: 0; transform: translateX(-20px); }
  to   { opacity: 1; transform: translateX(0); }
}
```

---

## Quick-Reference: Full Color Token Table

```css
:root {
  /* Backgrounds */
  --bg-animated:   linear-gradient(-45deg, #FF6B6B, #FFE66D, #4ECDC4, #C77DFF, #4D96FF);
  --card:          #FFFFFF;
  --card-shadow:   0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06);

  /* Text */
  --text:          #1A1A2E;
  --text-muted:    #6B7280;
  --text-light:    #9CA3AF;

  /* Brand */
  --primary:       #FF6B6B;
  --primary-dark:  #C94E4E;
  --yellow:        #FFD60A;
  --yellow-dark:   #C9A800;
  --teal:          #4ECDC4;
  --teal-dark:     #3AABA3;
  --purple:        #C77DFF;
  --blue:          #4D96FF;
  --green:         #06D6A0;
  --green-dark:    #04A07A;

  /* Answer buttons */
  --ans-red:       #FF6B6B;
  --ans-red-dark:  #C94E4E;
  --ans-blue:      #4D96FF;
  --ans-blue-dark: #2C72D6;
  --ans-yellow:    #FFD60A;
  --ans-yellow-dk: #C9A800;
  --ans-green:     #06D6A0;
  --ans-green-dk:  #04A07A;

  /* Rank colors */
  --rank-gold:     #FFD700;
  --rank-silver:   #C0C0C0;
  --rank-bronze:   #CD7F32;

  /* Feedback states */
  --correct-bg:    #D1FAE5;
  --correct-text:  #065F46;
  --correct-border:#06D6A0;
  --wrong-bg:      #FEE2E2;
  --wrong-text:    #991B1B;
  --wrong-border:  #FF6B6B;

  /* Shape */
  --radius-card:   24px;
  --radius-btn:    14px;
  --radius-pill:   999px;

  /* Fonts */
  --font-display:  'Nunito', sans-serif;
  --font-body:     'Plus Jakarta Sans', sans-serif;
}
```

---

## Constraints — Do Not Change

- All `socket.emit(...)` and `socket.on(...)` calls — leave exactly as-is.
- All `useState`, `useEffect`, `useRouter` logic — do not refactor.
- All routing (`/`, `/play`, `/host`) — keep as-is.
- `frontend/src/lib/socket.ts` and `frontend/src/lib/supabase.ts` — do not touch.
- `backend/server.js` — do not touch.
