'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { socket } from '@/lib/socket';
import { DEFAULT_TARGET_SCORE, getProgressPercent } from '@/lib/gameLogic';

type QuestionPayload = {
  questionIndex: number;
  question_text: string;
  options: string[];
};

type Player = {
  token: string;
  name: string;
  score: number;
  outTabbed: boolean;
  totalAnswered: number;
  totalCorrect: number;
  multiplier?: number;
};

/* ---------- Inline SVG Components ---------- */
const Logo = () => (
  <svg width="32" height="32" viewBox="0 0 44 44" fill="none" aria-label="ZapQuiz logo">
    <circle cx="22" cy="22" r="22" fill="url(#logoGradPlay)" />
    <path d="M26 6L14 24h10l-4 14 16-20H24l4-12z" fill="white" />
    <defs>
      <linearGradient id="logoGradPlay" x1="0" y1="0" x2="44" y2="44">
        <stop offset="0%" stopColor="#FF6B6B" />
        <stop offset="100%" stopColor="#FFE66D" />
      </linearGradient>
    </defs>
  </svg>
);

const StarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="#FFD60A" aria-hidden="true">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

/* Answer shape SVGs — triangle, diamond, circle, square */
const AnswerShapes = [
  // Triangle (red)
  <svg key="tri" width="18" height="18" viewBox="0 0 24 24" fill="white" aria-hidden="true">
    <path d="M12 4L2 20h20L12 4z"/>
  </svg>,
  // Diamond (blue)
  <svg key="dia" width="18" height="18" viewBox="0 0 24 24" fill="white" aria-hidden="true">
    <path d="M12 2L2 12l10 10 10-10L12 2z"/>
  </svg>,
  // Circle (yellow)
  <svg key="cir" width="18" height="18" viewBox="0 0 24 24" fill="white" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/>
  </svg>,
  // Square (green)
  <svg key="sq" width="18" height="18" viewBox="0 0 24 24" fill="white" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="3"/>
  </svg>,
];

const LETTERS = ['A', 'B', 'C', 'D'];
const AVATAR_COLORS = ['#FF6B6B', '#4D96FF', '#FFD60A', '#06D6A0', '#C77DFF', '#4ECDC4', '#FF8C42', '#845EC2'];

/* Confetti for end screen (deterministic to avoid SSR hydration mismatch) */
const CONFETTI_COLORS = ['#FF6B6B', '#FFE66D', '#4ECDC4', '#C77DFF', '#4D96FF', '#06D6A0'];
function seededRandom(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}
const confettiDots = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  size: 6 + seededRandom(i * 3 + 100) * 16,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  left: `${3 + seededRandom(i * 3 + 101) * 94}%`,
  duration: `${6 + seededRandom(i * 3 + 102) * 12}s`,
  delay: `${seededRandom(i * 3 + 103) * 4}s`,
}));

export default function Play() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<'waiting' | 'running' | 'ended'>('waiting');
  const [endTime, setEndTime] = useState<number | null>(null);
  const [targetScore, setTargetScore] = useState<number>(DEFAULT_TARGET_SCORE);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [questionCounter, setQuestionCounter] = useState(0);
  
  const [localState, setLocalState] = useState<'loading' | 'playing' | 'revealed'>('loading');
  const [currentQuestion, setCurrentQuestion] = useState<QuestionPayload | null>(null);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; correctOptionIndex: number } | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isOutTabbed, setIsOutTabbed] = useState(false);
  
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);

  // Refs to avoid stale closures in socket handlers
  const statusRef = useRef(status);
  useEffect(() => { statusRef.current = status; }, [status]);

  useEffect(() => {
    if (endTime && status === 'running') {
      const update = () => setTimeLeft(Math.max(0, Math.floor((endTime - Date.now()) / 1000)));
      update();
      const interval = setInterval(update, 1000);
      return () => clearInterval(interval);
    } else {
      setTimeLeft(null);
    }
  }, [endTime, status]);

  // Ref to track the auto-advance timer so we can cancel it
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear all gameplay-specific state (preserves leaderboard + identity)
  const resetGameplayState = useCallback(() => {
    setCurrentQuestion(null);
    setFeedback(null);
    setSelectedAnswer(null);
    setLocalState('loading');
    setQuestionCounter(0);

    // Cancel any pending auto-advance timer
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
  }, []);

  const handleLeave = () => {
    resetGameplayState();
    sessionStorage.removeItem('playerToken');
    sessionStorage.removeItem('playerName');
    localStorage.removeItem('playerToken');
    localStorage.removeItem('playerName');
    router.push('/');
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Main socket effect — registered ONCE (no status in deps)
  useEffect(() => {
    const savedToken = sessionStorage.getItem('playerToken');
    const savedName = sessionStorage.getItem('playerName');

    if (!savedToken) {
      router.push('/');
      return;
    }
    setToken(savedToken);

    if (!socket.connected) socket.connect();

    socket.emit('join', { token: savedToken, name: savedName });

    const handleSync = (data: any) => {
      setStatus(data.status);
      setEndTime(data.endTime || null);
      setTargetScore(data.targetScore || DEFAULT_TARGET_SCORE);
      setLeaderboard(data.leaderboard || []);

      if (data.status === 'running') {
        // Reconnect into a running game — clear stale state & fetch a question
        resetGameplayState();
        socket.emit('get_question');
      } else {
        // Joined into waiting or ended — clear any leftover gameplay state
        resetGameplayState();
      }
    };

    const handleStateUpdate = (data: any) => {
      const prevStatus = statusRef.current;
      setStatus(data.status);
      setEndTime(data.endTime || null);
      setTargetScore(data.targetScore || DEFAULT_TARGET_SCORE);
      setLeaderboard(data.leaderboard || []);

      if (data.status === 'running' && prevStatus !== 'running') {
        // Game just started — clear stale state, fetch first question
        resetGameplayState();
        socket.emit('get_question');
      } else if (data.status !== 'running' && prevStatus === 'running') {
        // Game just ended or reset — clear gameplay state, keep leaderboard
        resetGameplayState();
      }
    };

    const handleReceiveQuestion = (data: any) => {
      setCurrentQuestion(data);
      setSelectedAnswer(null);
      setFeedback(null);
      setLocalState('playing');
      setQuestionCounter(prev => prev + 1);
    };

    const handleAnswerResult = (data: any) => {
      setFeedback(data);
      setLocalState('revealed');
      
      // Store timeout ref so we can cancel on game end/reset
      autoAdvanceTimer.current = setTimeout(() => {
        // Guard: only advance if game is still running
        if (statusRef.current !== 'running') return;
        socket.emit('get_question');
      }, 2500);
    };

    const handleLobbyReset = () => {
      resetGameplayState();
      sessionStorage.removeItem('playerToken');
      sessionStorage.removeItem('playerName');
      localStorage.removeItem('playerToken');
      localStorage.removeItem('playerName');
      router.push('/');
    };

    socket.on('sync', handleSync);
    socket.on('state_update', handleStateUpdate);
    socket.on('receive_question', handleReceiveQuestion);
    socket.on('answer_result', handleAnswerResult);
    socket.on('lobby_reset', handleLobbyReset);

    return () => {
      socket.off('sync', handleSync);
      socket.off('state_update', handleStateUpdate);
      socket.off('receive_question', handleReceiveQuestion);
      socket.off('answer_result', handleAnswerResult);
      socket.off('lobby_reset', handleLobbyReset);
    };
  }, [router, resetGameplayState]);  // No `status` dep — uses statusRef instead

  useEffect(() => {
    if (!token) return;

    const handleVisibilityChange = () => {
      if (document.hidden && !isOutTabbed && statusRef.current === 'running') {
        setIsOutTabbed(true);
        socket.emit('tab_switched');
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleVisibilityChange);
    };
  }, [token, isOutTabbed]);

  const submitAnswer = (answer: string) => {
    if (localState !== 'playing' || !token || !currentQuestion) return;
    setLocalState('loading'); 
    setSelectedAnswer(answer);
    socket.emit('submit_answer', { questionIndex: currentQuestion.questionIndex, answer });
  };

  const myRank = leaderboard.findIndex(p => p.token === token) + 1;
  const myPlayer = leaderboard.find(p => p.token === token);
  const myScore = myPlayer ? myPlayer.score : 0;
  const playerName = myPlayer?.name || (typeof window !== 'undefined' ? sessionStorage.getItem('playerName') : null) || 'You';

  /* ==================== WAITING ROOM ==================== */
  if (status === 'waiting') {
    const visiblePlayers = leaderboard.slice(0, 8);
    const remaining = leaderboard.length - visiblePlayers.length;

    return (
      <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="center-card" style={{ maxWidth: '520px', width: '100%' }}>
          {/* Bouncing emoji */}
          <div style={{ fontSize: '4rem', marginBottom: '0.5rem', animation: 'bounce 1.5s ease-in-out infinite' }}>
            👋
          </div>

          <h1 className="title" style={{ fontSize: '2rem' }}>
            You&apos;re in, <span className="gradient-text">{isMounted ? playerName : 'You'}</span>! 🎉
          </h1>

          {/* Player count pill */}
          <div style={{ margin: '1rem 0' }}>
            <span className="pill-badge">
              👥 {leaderboard.length} Player{leaderboard.length !== 1 ? 's' : ''} Connected
            </span>
          </div>

          {/* Avatar bubbles */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', marginTop: '1rem' }}>
            {visiblePlayers.map((p, i) => (
              <div
                key={p.token}
                className="avatar-bubble"
                style={{ backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                title={p.name}
              >
                {p.name.charAt(0).toUpperCase()}
              </div>
            ))}
            {remaining > 0 && (
              <div
                className="avatar-bubble"
                style={{ backgroundColor: '#9CA3AF', fontSize: '0.75rem' }}
              >
                +{remaining}
              </div>
            )}
          </div>

          {/* Waiting message */}
          <p style={{ marginTop: '2rem', color: 'var(--text-muted)', fontWeight: 600, fontFamily: 'var(--font-body)' }}>
            Waiting for host to start
            <span className="pulsing-dots">
              <span></span><span></span><span></span>
            </span>
          </p>
        </div>
      </div>
    );
  }

  /* ==================== ENDED STATE ==================== */
  if (status === 'ended') {
    const getRankClass = () => {
      if (myRank === 1) return 'rank-1';
      if (myRank === 2) return 'rank-2';
      if (myRank === 3) return 'rank-3';
      return 'rank-other';
    };
    const getRankLabel = () => {
      if (myRank === 1) return '🏆 CHAMPION!';
      if (myRank === 2) return '🥈 Runner Up!';
      if (myRank === 3) return '🥉 Third Place!';
      return '🎮 Well Played!';
    };

    return (
      <>
        {/* Confetti burst */}
        {isMounted && confettiDots.map((dot) => (
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

        <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="center-card" style={{ maxWidth: '560px', width: '100%' }}>
            <h1 className="title" style={{ fontSize: '2.5rem' }}>🏁 GAME OVER!</h1>

            {/* Rank badge */}
            <div style={{ margin: '1.5rem 0' }}>
              <div className={`rank-badge ${getRankClass()}`}>
                <span style={{ fontSize: '3rem' }}>{myRank === 1 ? '🏆' : `#${myRank || '-'}`}</span>
                <span style={{ fontSize: '1.1rem' }}>{getRankLabel()}</span>
              </div>
            </div>

            {/* Score */}
            <div style={{ marginBottom: '1.5rem', animation: 'countUp 0.5s ease' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '2.5rem', color: 'var(--primary)' }}>
                {myScore}
              </span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                points
              </span>
            </div>

            {/* Final leaderboard */}
            <ul className="leaderboard" style={{ textAlign: 'left' }}>
              {leaderboard.slice(0, 10).map((p, i) => (
                <li
                  key={p.token}
                  className="leaderboard-item"
                  style={{
                    '--i': i,
                    borderLeftColor: p.token === token ? 'var(--purple)' : 'var(--primary)',
                    backgroundColor: p.token === token ? '#FFFBEB' : 'white',
                  } as React.CSSProperties}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                    <strong style={{ 
                      fontSize: '1.2rem', 
                      color: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : 'var(--primary)', 
                      width: '30px',
                      flexShrink: 0,
                      fontFamily: 'var(--font-display)',
                    }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                    </strong>
                    <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name} {p.token === token && <span style={{ color: 'var(--purple)', fontSize: '0.85rem' }}>(You)</span>}
                    </span>
                  </span>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.2rem', color: 'var(--primary)' }}>
                    {p.score}
                  </span>
                </li>
              ))}
            </ul>

            <button 
              className="btn btn-secondary" 
              style={{ marginTop: '2.5rem', maxWidth: '300px' }}
              onClick={handleLeave}
            >
              Exit to Home
            </button>
          </div>
        </div>
      </>
    );
  }

  /* ==================== ACTIVE QUESTION ==================== */
  if ((localState === 'playing' || localState === 'revealed' || localState === 'loading') && currentQuestion) {
    const myProgressPercent = getProgressPercent(myScore, targetScore);
    const duckIndicatorLeft = `clamp(18px, ${myProgressPercent}%, calc(100% - 18px))`;

    const getMultiplierBackground = (mult: number) => {
      if (mult >= 3.0) return 'repeating-linear-gradient(45deg, #FF6B6B, #FF6B6B 10px, #FF8C42 10px, #FF8C42 20px)';
      if (mult >= 2.0) return 'repeating-linear-gradient(45deg, #FFD60A, #FFD60A 10px, #FF9F1C 10px, #FF9F1C 20px)';
      if (mult > 1.0) return 'repeating-linear-gradient(45deg, #4D96FF, #4D96FF 10px, #4ECDC4 10px, #4ECDC4 20px)';
      return 'linear-gradient(90deg, var(--primary), var(--primary))';
    };

    return (
      <div className="container" style={{ display: 'flex', flexDirection: 'column', flex: 1, paddingTop: '0.5rem' }}>
        <style>{`
          @keyframes stripe-scroll {
            0% { background-position: 0 0; }
            100% { background-position: 28px 0; }
          }
        `}</style>
        
        {/* Duck Progress Bar at the top */}
        <div style={{ marginBottom: '0.5rem', background: 'white', borderRadius: '16px', padding: '0.75rem 1rem', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--primary)', fontSize: '1.1rem' }}>Progress Goal</span>
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--text-muted)' }}>{myScore} / {targetScore} pts</span>
          </div>
          
          <div style={{ position: 'relative', height: '24px', background: 'var(--blue-light, #E0F2FE)', borderRadius: '12px', marginTop: '1rem' }}>
            
            {/* Animated Fill */}
            <div style={{ 
                position: 'absolute',
                left: 0,
                top: 0,
                height: '100%',
                width: `${myProgressPercent}%`,
                backgroundImage: myPlayer ? getMultiplierBackground(myPlayer.multiplier || 1.0) : 'none',
                backgroundColor: myPlayer ? 'transparent' : 'var(--primary)',
                backgroundSize: '200% 100%',
                animation: myPlayer && (myPlayer.multiplier || 1.0) > 1.0 ? `stripe-scroll ${1.5 / (myPlayer.multiplier || 1.0)}s linear infinite` : 'none',
                transition: 'width 0.5s ease-out, background-image 0.5s ease, background-color 0.5s ease',
                borderRadius: '12px',
                zIndex: 1
            }} />

            {/* Other Players (Closest 10 Pointers) */}
            {(() => {
              const myIndex = leaderboard.findIndex(p => p.token === token);
              if (myIndex === -1) return null;
              const startIndex = Math.max(0, myIndex - 5);
              const endIndex = Math.min(leaderboard.length, myIndex + 6);
              const closestPlayers = leaderboard.slice(startIndex, endIndex).filter(p => p.token !== token);
              
              return closestPlayers.map(p => {
                const percent = getProgressPercent(p.score, targetScore);
                return (
                  <div key={p.token} style={{
                    position: 'absolute',
                    left: `clamp(6px, ${percent}%, calc(100% - 6px))`,
                    top: '-8px',
                    width: '0',
                    height: '0',
                    borderLeft: '5px solid transparent',
                    borderRight: '5px solid transparent',
                    borderTop: '8px solid #9CA3AF',
                    transform: 'translateX(-50%)',
                    transition: 'left 0.5s ease-out',
                    zIndex: 5
                  }} title="Nearby Player" />
                );
              });
            })()}
            
            {/* My Duck Indicator */}
            <div style={{
              position: 'absolute',
              left: duckIndicatorLeft,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              transition: 'left 0.5s ease-out',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '1.8rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>🦆</span>
            </div>
          </div>
        </div>

        {/* Top Bar */}
        <div className="top-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Logo />
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>Player</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
                {isMounted ? playerName : 'You'}
              </div>
            </div>
          </div>
          <div>
            {timeLeft !== null && (
              <span className="pill-badge" style={{ background: '#FFFBEB', color: 'var(--primary)' }}>
                ⏱ {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <StarIcon />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.5rem', color: 'var(--primary)' }}>
              {myScore}
            </span>
          </div>
        </div>

        {/* Progress bar for auto-advance */}
        <div className="progress-wrapper">
          <div className={`progress-fill ${localState === 'revealed' ? 'shrinking' : ''}`}></div>
        </div>
        
        {/* Main Question Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          
          {/* Question card */}
          <div className="center-card" style={{ maxWidth: '100%', margin: '0 0 1.5rem 0', padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '160px' }}>
            <h2 style={{ fontSize: '1.8rem', fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--text)', lineHeight: 1.4, overflowWrap: 'anywhere' }}>
              {currentQuestion.question_text}
            </h2>
            
            {/* In-Card Feedback */}
            <div style={{ minHeight: '50px', marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {localState === 'revealed' && feedback && (
                <span className={`feedback-text ${feedback.isCorrect ? 'feedback-correct' : 'feedback-wrong'}`}>
                  {feedback.isCorrect ? '✅ You got it right!' : '❌ Incorrect!'}
                </span>
              )}
            </div>
          </div>

          {/* Answer Grid */}
          <div className="grid-2x2" style={{ marginTop: 0 }}>
            {currentQuestion.options.map((opt, i) => {
              let btnClass = `choice-btn color-${i % 4}`;
              let label = null;
              
              if (localState === 'revealed' && feedback) {
                // Use correctOptionIndex (number) instead of leaked correctAnswer string
                const isCorrectOption = i === feedback.correctOptionIndex;
                const isUserChoice = opt === selectedAnswer;

                if (isCorrectOption) {
                  btnClass += ' correct-answer';
                  label = <span className="choice-label" style={{ color: 'var(--correct-text)' }}>✓ Correct</span>;
                } else if (isUserChoice) {
                  btnClass += ' wrong-answer';
                  label = <span className="choice-label" style={{ color: 'var(--wrong-text)' }}>✗ Your Pick</span>;
                } else {
                  btnClass += ' dimmed-answer';
                }
              }

              return (
                <button 
                  key={i} 
                  className={btnClass}
                  onClick={() => submitAnswer(opt)}
                  disabled={localState !== 'playing'}
                  style={{ transition: 'all 0.3s ease' }}
                >
                  <span className="answer-shape">{AnswerShapes[i % 4]}</span>
                  <span className="answer-letter">{LETTERS[i]}</span>
                  {opt}
                  {label}
                </button>
              );
            })}
          </div>
        </div>

      </div>
    );
  }

  /* ==================== FALLBACK LOADING ==================== */
  return (
    <div className="center-card">
      <div style={{ fontSize: '2.5rem', animation: 'bounce 1.5s ease-in-out infinite', marginBottom: '1rem' }}>⚡</div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, color: 'var(--primary)' }}>Loading...</h2>
    </div>
  );
}
