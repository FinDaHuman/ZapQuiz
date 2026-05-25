'use client';

import { useEffect, useState } from 'react';
import { socket } from '@/lib/socket';
import { DEFAULT_TARGET_SCORE, getProgressPercent } from '@/lib/gameLogic';

type Player = {
  token: string;
  name: string;
  score: number;
  outTabbed: boolean;
  totalAnswered: number;
  totalCorrect: number;
};

type QuizState = {
  status: 'waiting' | 'running' | 'ended';
  endTime?: number;
  targetScore?: number;
};

/* ---------- Inline SVG Components ---------- */
const Logo = () => (
  <svg width="36" height="36" viewBox="0 0 44 44" fill="none" aria-label="ZapQuiz logo">
    <circle cx="22" cy="22" r="22" fill="url(#logoGradHost)" />
    <path d="M26 6L14 24h10l-4 14 16-20H24l4-12z" fill="white" />
    <defs>
      <linearGradient id="logoGradHost" x1="0" y1="0" x2="44" y2="44">
        <stop offset="0%" stopColor="#FF6B6B" />
        <stop offset="100%" stopColor="#FFE66D" />
      </linearGradient>
    </defs>
  </svg>
);

const AVATAR_COLORS = ['#FF6B6B', '#4D96FF', '#FFD60A', '#06D6A0', '#C77DFF', '#4ECDC4', '#FF8C42', '#845EC2'];

export default function HostDashboard() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [quizState, setQuizState] = useState<QuizState | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');
  const [duration, setDuration] = useState(5);

  useEffect(() => {
    if (quizState?.endTime && quizState.status === 'running') {
      const update = () => setTimeLeft(Math.max(0, Math.floor((quizState.endTime! - Date.now()) / 1000)));
      update();
      const interval = setInterval(update, 1000);
      return () => clearInterval(interval);
    } else {
      setTimeLeft(null);
    }
  }, [quizState?.endTime, quizState?.status]);

  useEffect(() => {
    if (!socket.connected) socket.connect();

    const handleStateUpdate = (data: any) => {
      setQuizState({ status: data.status, endTime: data.endTime, targetScore: data.targetScore });
      setPlayers(data.leaderboard || []);
    };
    
    const handleSync = (data: any) => {
      handleStateUpdate(data);
      setIsAuthenticated(true);
      setAuthError('');
    };

    const handleAuthError = (data: any) => {
      setAuthError(data.message);
    };

    socket.on('state_update', handleStateUpdate);
    socket.on('sync', handleSync);
    socket.on('auth_error', handleAuthError);

    return () => {
      socket.off('state_update', handleStateUpdate);
      socket.off('sync', handleSync);
      socket.off('auth_error', handleAuthError);
    };
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    socket.emit('join', { token: 'host-view', name: 'Host', password });
  };

  const downloadCSV = () => {
    const header = "Rank,Name,Score,Questions Answered,Correct,Accuracy %,Tab Switched\n";
    const csvRow = players
      .filter(p => p.token !== 'host-view')
      .map((p, index) => {
        const accuracy = p.totalAnswered > 0 ? Math.round((p.totalCorrect / p.totalAnswered) * 100) : 0;
        const safeName = p.name.replace(/"/g, '""');
        return `${index + 1},"${safeName}",${p.score},${p.totalAnswered},${p.totalCorrect},${accuracy}%,${p.outTabbed}`;
      })
      .join("\n");
    const csvContent = header + csvRow;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "quiz_results.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAction = (action: string) => {
    socket.emit('host_action', { action, password, duration });
  };

  if (!isAuthenticated) {
    return (
      <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '20px', width: '100%', maxWidth: '400px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
          <h2 style={{ color: 'var(--primary)', textAlign: 'center', marginBottom: '1.5rem' }}>Host Login</h2>
          {authError && <div style={{ color: 'red', textAlign: 'center', marginBottom: '1rem' }}>{authError}</div>}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input
              type="password"
              placeholder="Enter Host Password"
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Login</button>
          </form>
        </div>
      </div>
    );
  }

  const currentStatus = quizState?.status || 'waiting';
  const activePlayers = players.filter(p => p.token !== 'host-view');
  const goalScore = quizState?.targetScore && quizState.targetScore > 0
    ? quizState.targetScore
    : DEFAULT_TARGET_SCORE;
  const avgScore = activePlayers.length > 0
    ? Math.round(activePlayers.reduce((sum, p) => sum + p.score, 0) / activePlayers.length)
    : 0;
  const flaggedCount = activePlayers.filter(p => p.outTabbed).length;

  return (
    <div className="container" style={{ maxWidth: '1200px' }}>
      <div className="host-layout">

        {/* ========== LEFT PANEL ========== */}
        <div className="host-panel-left">
          {/* Logo + Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
            <Logo />
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.2rem', color: 'var(--text)', margin: 0 }}>
                HOST PANEL
              </h2>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>ZapQuiz</span>
            </div>
          </div>

          {/* Status Badge */}
          <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className={`status-badge status-${currentStatus}`}>
              <span className="status-dot"></span>
              {currentStatus.toUpperCase()}
            </div>
            {timeLeft !== null && (
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.4rem', color: 'var(--primary)', background: '#F3F4F6', padding: '4px 12px', borderRadius: '12px' }}>
                ⏱ {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </div>
            )}
          </div>

          {/* Info text */}
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6, fontFamily: 'var(--font-body)', marginBottom: '0.5rem' }}>
            Players navigate questions at their own pace until time runs out, the host ends the game, or someone reaches the score goal.
          </p>

          {/* Action Buttons */}
          <div className="host-btn-stack">
            {currentStatus !== 'running' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', background: '#F3F4F6', padding: '8px 12px', borderRadius: '12px', justifyContent: 'center' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-body)', marginRight: 'auto' }}>⏱ Duration</span>
                <button 
                  onClick={() => setDuration(prev => Math.max(1, prev - 1))}
                  style={{ background: 'white', border: '1px solid #ccc', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  -
                </button>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', width: '30px', textAlign: 'center' }}>{duration}m</span>
                <button 
                  onClick={() => setDuration(prev => Math.min(30, prev + 1))}
                  style={{ background: 'white', border: '1px solid #ccc', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  +
                </button>
              </div>
            )}
            <button 
              className="btn btn-primary" 
              onClick={() => handleAction('start')}
              disabled={currentStatus === 'running'}
              id="start-game-btn"
            >
              ▶ START GAME
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={() => handleAction('end')}
              disabled={currentStatus !== 'running'}
              id="end-game-btn"
            >
              ⏹ END GAME
            </button>
            <button 
              className="btn btn-teal" 
              onClick={() => handleAction('waiting')}
              id="reset-lobby-btn"
            >
              🔄 RESET LOBBY
            </button>
            {currentStatus === 'ended' && (
              <button 
                className="btn btn-success" 
                onClick={downloadCSV}
                id="export-csv-btn"
              >
                📥 EXPORT CSV
              </button>
            )}
          </div>

          {/* Stats Pills */}
          <div className="host-stats">
            <span className="host-stat-pill">👥 {activePlayers.length} Players</span>
            <span className="host-stat-pill">📊 Avg: {avgScore}</span>
            {flaggedCount > 0 && (
              <span className="host-stat-pill" style={{ background: 'var(--wrong-bg)', color: 'var(--wrong-text)' }}>
                ⚠️ {flaggedCount} Flagged
              </span>
            )}
          </div>
        </div>

        {/* ========== RIGHT PANEL ========== */}
        <div className="host-panel-right">
          {currentStatus === 'waiting' ? (
            <>
              <h2 style={{ 
                fontFamily: 'var(--font-display)', 
                fontWeight: 900, 
                fontSize: '1.5rem', 
                color: 'var(--text)', 
                marginBottom: '1.5rem', 
                textAlign: 'center' 
              }}>
                <span className="pill-badge" style={{ fontSize: '1rem' }}>
                  👥 {activePlayers.length} Player{activePlayers.length !== 1 ? 's' : ''} Connected
                </span>
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' }}>
                {activePlayers.map((p, i) => (
                  <div key={p.token} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '10px', 
                    padding: '12px 20px', 
                    background: AVATAR_COLORS[i % AVATAR_COLORS.length], 
                    color: 'white', 
                    borderRadius: '14px', 
                    fontWeight: 800, 
                    fontSize: '1.1rem',
                    fontFamily: 'var(--font-display)',
                    boxShadow: `0 4px 0 ${AVATAR_COLORS[i % AVATAR_COLORS.length]}99`,
                    transition: 'transform 0.15s',
                  }}>
                    <span style={{ 
                      width: '32px', 
                      height: '32px', 
                      borderRadius: '50%', 
                      background: 'rgba(255,255,255,0.3)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      fontSize: '0.9rem',
                      fontWeight: 900,
                    }}>
                      {p.name.charAt(0).toUpperCase()}
                    </span>
                    {p.name}
                  </div>
                ))}
                {activePlayers.length === 0 && (
                  <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontStyle: 'italic', padding: '2rem' }}>
                    Waiting for players to join...
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ 
                  fontFamily: 'var(--font-display)', 
                  fontWeight: 900, 
                  fontSize: '1.4rem', 
                  color: 'var(--text)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}>
                  🏆 Live Leaderboard
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <span className="pill-badge">
                    Goal: {goalScore} pts
                  </span>
                  <span className="pill-badge">
                    {activePlayers.length} Player{activePlayers.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              <ul className="leaderboard">
                {activePlayers.slice(0, 10).map((p, index) => {
                  const progressPercent = getProgressPercent(p.score, goalScore);
                  
                  // Vivid colors for the bar itself
                  const barColor = index === 0 ? 'linear-gradient(90deg, #FFD700, #FFDF00)' : 
                                   index === 1 ? 'linear-gradient(90deg, #C0C0C0, #E0E0E0)' : 
                                   index === 2 ? 'linear-gradient(90deg, #CD7F32, #DDA15E)' : 
                                   'var(--primary)';

                  return (
                  <li 
                    key={p.token} 
                    className="leaderboard-item"
                    style={{ 
                      '--i': index, 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'stretch',
                      padding: '1rem',
                      gap: '0.5rem'
                    } as React.CSSProperties}
                  >
                    {/* Top Row: Name and Score */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <strong style={{ 
                          fontSize: '1.3rem', 
                          color: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : 'var(--primary)', 
                          width: '36px',
                          fontFamily: 'var(--font-display)',
                          textAlign: 'center',
                        }}>
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                        </strong> 
                        <span style={{ fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: '1.1rem' }}>
                          {p.name}
                        </span>
                        {p.totalAnswered > 0 && (
                          <span style={{ 
                            fontSize: '0.75rem', 
                            color: 'var(--text-muted)', 
                            fontFamily: 'var(--font-body)',
                            background: '#F3F4F6',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            fontWeight: 700
                          }}>
                            {Math.round((p.totalCorrect / p.totalAnswered) * 100)}% acc
                          </span>
                        )}
                        {p.outTabbed && <span className="out-tabbed">⚠️ Tab Switch</span>}
                      </span>
                      <span style={{ 
                        fontFamily: 'var(--font-display)', 
                        fontWeight: 900, 
                        fontSize: '1.4rem', 
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: '4px',
                      }}>
                        {p.score}
                        <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>pts</small>
                      </span>
                    </div>

                    {/* Bottom Row: Dedicated Progress Track */}
                    <div style={{ 
                      width: '100%', 
                      height: '12px', 
                      background: '#F3F4F6', 
                      borderRadius: '6px',
                      overflow: 'hidden',
                      marginTop: '4px',
                      boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)'
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${progressPercent}%`,
                        background: barColor,
                        borderRadius: '6px',
                        transition: 'width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      }} />
                    </div>
                  </li>
                )})}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
