'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import Link from 'next/link';

/* ---------- Inline SVG Components ---------- */
const Logo = () => (
  <svg width="52" height="52" viewBox="0 0 44 44" fill="none" aria-label="ZapQuiz logo">
    <circle cx="22" cy="22" r="22" fill="url(#logoGrad)" />
    <path d="M26 6L14 24h10l-4 14 16-20H24l4-12z" fill="white" />
    <defs>
      <linearGradient id="logoGrad" x1="0" y1="0" x2="44" y2="44">
        <stop offset="0%" stopColor="#FF6B6B" />
        <stop offset="100%" stopColor="#FFE66D" />
      </linearGradient>
    </defs>
  </svg>
);

/* ---------- Confetti Config (deterministic to avoid SSR hydration mismatch) ---------- */
const CONFETTI_COLORS = ['#FF6B6B', '#FFE66D', '#4ECDC4', '#C77DFF', '#4D96FF', '#06D6A0'];
function seededRandom(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}
const confettiDots = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  size: 8 + seededRandom(i * 3 + 1) * 14,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  left: `${5 + seededRandom(i * 3 + 2) * 90}%`,
  duration: `${8 + seededRandom(i * 3 + 3) * 10}s`,
  delay: `${seededRandom(i * 3 + 4) * 8}s`,
}));

/* ---------- Landing Page ---------- */
export default function Home() {
  const [name, setName] = useState('');
  const router = useRouter();

  // Reconnection logic: if token exists, auto-join
  useEffect(() => {
    const token = localStorage.getItem('playerToken');
    if (token) {
      router.push('/play');
    }
  }, [router]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Generate token and save to localStorage
    const token = uuidv4();
    localStorage.setItem('playerToken', token);
    localStorage.setItem('playerName', name.trim());

    router.push('/play');
  };

  return (
    <>
      {/* Floating confetti */}
      {confettiDots.map((dot) => (
        <div
          key={dot.id}
          className="confetti-dot"
          style={{
            width: dot.size,
            height: dot.size,
            backgroundColor: dot.color,
            left: dot.left,
            animationDuration: dot.duration,
            animationDelay: dot.delay,
          }}
        />
      ))}

      <div className="center-card" style={{ marginTop: '12vh' }}>
        {/* Logo + Brand */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '0.5rem' }}>
          <Logo />
          <h1 className="title gradient-text" style={{ marginBottom: 0 }}>ZapQuiz</h1>
        </div>

        <p className="tagline">Answer fast. Score big. Win everything.</p>

        {/* Join Form */}
        <form onSubmit={handleJoin}>
          <input
            type="text"
            id="nickname-input"
            className="input-field"
            placeholder="🎮  Enter your nickname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            required
          />
          <button type="submit" id="join-button" className="btn btn-primary" style={{ fontSize: '1.25rem' }}>
            LET&apos;S GO! →
          </button>
        </form>
      </div>

      {/* Host link */}
      <div style={{ textAlign: 'center' }}>
        <Link href="/host" className="host-link">
          Hosting a game? →
        </Link>
      </div>
    </>
  );
}
