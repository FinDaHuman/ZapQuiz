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
};

export default function HostDashboard() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [quizState, setQuizState] = useState<QuizState | null>(null);

  useEffect(() => {
    if (!socket.connected) socket.connect();

    socket.emit('join', { token: 'host-view', name: 'Host' });

    const handleStateUpdate = (data: any) => {
      setQuizState({ status: data.status });
      setPlayers(data.leaderboard || []);
    };

    socket.on('state_update', handleStateUpdate);
    socket.on('sync', handleStateUpdate);

    return () => {
      socket.off('state_update', handleStateUpdate);
      socket.off('sync', handleStateUpdate);
    };
  }, []);

  const handleAction = (action: string) => {
    socket.emit('host_action', { action });
  };

  return (
    <div className="container" style={{ maxWidth: '1200px' }}>
      <h1 className="title" style={{ textAlign: 'center', color: 'white', textShadow: '0 4px 10px rgba(0,0,0,0.2)', fontSize: '3.5rem' }}>
        Host Dashboard
      </h1>
      
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '3rem' }}>
        <button 
          className="btn btn-primary" 
          style={{ maxWidth: '200px' }} 
          onClick={() => handleAction('start')}
          disabled={quizState?.status === 'running'}
        >
          Start Game
        </button>
        <button 
          className="btn btn-secondary" 
          style={{ maxWidth: '200px' }} 
          onClick={() => handleAction('end')}
          disabled={quizState?.status !== 'running'}
        >
          End Game
        </button>
        <button 
          className="btn" 
          style={{ maxWidth: '200px', backgroundColor: 'white', color: 'black' }} 
          onClick={() => handleAction('waiting')}
        >
          Reset Lobby
        </button>
      </div>

      <div style={{ display: 'flex', gap: '2rem' }}>
        <div style={{ flex: 1, backgroundColor: 'white', padding: '2rem', borderRadius: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
          <h2 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>Game Status: {quizState?.status.toUpperCase()}</h2>
          <p style={{ fontSize: '1.2rem', color: '#666', lineHeight: '1.5' }}>
            The timer has been removed! Players are currently navigating the question bank at their own independent speeds.
            They will continue to cycle through random questions until you click <strong>End Game</strong>.
          </p>
        </div>

        <div style={{ flex: 2, backgroundColor: 'white', padding: '2rem', borderRadius: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
          <h2 style={{ color: 'var(--primary)', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>Live Leaderboard</span>
            <span>{players.length} Players</span>
          </h2>
          <ul className="leaderboard">
            {players.map((p, index) => (
              <li key={p.token} className="leaderboard-item">
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  <strong style={{ fontSize: '1.4rem', color: 'var(--primary)', marginRight: '1rem', width: '30px' }}>#{index + 1}</strong> 
                  {p.name} 
                  {p.outTabbed && <span className="out-tabbed">⚠️ Tab Switched</span>}
                </span>
                <span style={{ fontSize: '1.4rem', color: 'var(--success)' }}>{p.score} <small style={{ color: '#888', fontSize: '1rem' }}>pts</small></span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
