'use client';

import { useEffect, useState } from 'react';
import { socket } from '@/lib/socket';

type Player = {
  token: string;
  name: string;
  score: number;
  outTabbed: boolean;
};

type QuizState = {
  status: 'waiting' | 'running' | 'ended';
  currentQuestionIndex: number;
};

export default function HostDashboard() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [quizState, setQuizState] = useState<QuizState | null>(null);

  useEffect(() => {
    if (!socket.connected) socket.connect();

    // Since we didn't add a specific host login, we just join as host to get sync
    // In production, require an admin password here.
    socket.emit('join', { token: 'host-view', name: 'Host' });

    const handleStateUpdate = (data: any) => {
      setQuizState({ status: data.status, currentQuestionIndex: data.currentQuestionIndex });
      setPlayers(data.leaderboard || []);
    };

    const handleSync = (data: any) => {
      setQuizState({ status: data.status, currentQuestionIndex: data.currentQuestionIndex });
      setPlayers(data.leaderboard || []);
    };

    socket.on('state_update', handleStateUpdate);
    socket.on('sync', handleSync);

    return () => {
      socket.off('state_update', handleStateUpdate);
      socket.off('sync', handleSync);
    };
  }, []);

  const handleAction = (action: string, index?: number) => {
    socket.emit('host_action', { action, index });
  };

  return (
    <div className="container">
      <h1 className="title">Host Dashboard</h1>
      
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <button 
          className="btn btn-primary" 
          onClick={() => handleAction('start')}
          disabled={quizState?.status === 'running'}
        >
          Start Quiz
        </button>
        <button 
          className="btn btn-primary" 
          onClick={() => handleAction('next', (quizState?.currentQuestionIndex ?? 0) + 1)}
          disabled={quizState?.status !== 'running'}
        >
          Next Question
        </button>
        <button 
          className="btn btn-secondary" 
          onClick={() => handleAction('end')}
        >
          End Quiz
        </button>
        <button 
          className="btn" 
          onClick={() => handleAction('waiting')}
        >
          Reset to Lobby
        </button>
      </div>

      <div style={{ display: 'flex', gap: '2rem' }}>
        <div style={{ flex: 1, backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h2>Game Status: {quizState?.status.toUpperCase()}</h2>
          <p style={{ marginTop: '0.5rem', fontSize: '1.2rem' }}>Current Question Index: {quizState?.currentQuestionIndex}</p>
        </div>

        <div style={{ flex: 1, backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h2>Live Leaderboard ({players.length} Players)</h2>
          <ul className="leaderboard">
            {players.map((p, index) => (
              <li key={p.token} className="leaderboard-item">
                <span>
                  <strong>#{index + 1}</strong> {p.name} 
                  {p.outTabbed && <span className="out-tabbed">⚠️ Tab Switched</span>}
                </span>
                <span>{p.score} pts</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
