'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { socket } from '@/lib/socket';

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
};

export default function Play() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<'waiting' | 'running' | 'ended'>('waiting');
  
  const [localState, setLocalState] = useState<'loading' | 'playing' | 'revealed'>('loading');
  const [currentQuestion, setCurrentQuestion] = useState<QuestionPayload | null>(null);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; correctAnswer: string } | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isOutTabbed, setIsOutTabbed] = useState(false);
  
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);

  useEffect(() => {
    const savedToken = localStorage.getItem('playerToken');
    const savedName = localStorage.getItem('playerName');

    if (!savedToken) {
      router.push('/');
      return;
    }
    setToken(savedToken);

    if (!socket.connected) socket.connect();

    socket.emit('join', { token: savedToken, name: savedName });

    const handleSync = (data: any) => {
      setStatus(data.status);
      setLeaderboard(data.leaderboard || []);
      if (data.status === 'running') {
        socket.emit('get_question', { token: savedToken });
      }
    };

    const handleStateUpdate = (data: any) => {
      setStatus(data.status);
      setLeaderboard(data.leaderboard || []);
      if (data.status === 'running' && status !== 'running') {
        socket.emit('get_question', { token: savedToken });
      }
    };

    const handleReceiveQuestion = (data: any) => {
      setCurrentQuestion(data);
      setSelectedAnswer(null);
      setFeedback(null);
      setLocalState('playing');
    };

    const handleAnswerResult = (data: any) => {
      setFeedback(data);
      setLocalState('revealed');
      
      setTimeout(() => {
        socket.emit('get_question', { token: savedToken });
      }, 2500);
    };

    socket.on('sync', handleSync);
    socket.on('state_update', handleStateUpdate);
    socket.on('receive_question', handleReceiveQuestion);
    socket.on('answer_result', handleAnswerResult);

    return () => {
      socket.off('sync', handleSync);
      socket.off('state_update', handleStateUpdate);
      socket.off('receive_question', handleReceiveQuestion);
      socket.off('answer_result', handleAnswerResult);
    };
  }, [router, status]);

  useEffect(() => {
    if (!token) return;

    const handleVisibilityChange = () => {
      if (document.hidden && !isOutTabbed) {
        setIsOutTabbed(true);
        socket.emit('tab_switched', { token });
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
    socket.emit('submit_answer', { token, questionIndex: currentQuestion.questionIndex, answer });
  };

  const myRank = leaderboard.findIndex(p => p.token === token) + 1;
  const myPlayer = leaderboard.find(p => p.token === token);
  const myScore = myPlayer ? myPlayer.score : 0;

  if (status === 'waiting') {
    return (
      <div className="center-card">
        <h1 className="title">You're in!</h1>
        <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Get ready to play at your own pace.</p>
        <p style={{ marginTop: '1.5rem', color: '#666' }}>Waiting for host to start...</p>
      </div>
    );
  }

  if (status === 'ended') {
    return (
      <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="center-card" style={{ width: '100%' }}>
          <h1 className="title">Time's Up!</h1>
          <h2 style={{ color: 'var(--primary)', marginBottom: '0.5rem', fontSize: '2rem' }}>Final Score: {myScore}</h2>
          <h2 style={{ color: 'var(--success)', marginBottom: '1.5rem', fontSize: '2.5rem' }}>Final Rank: #{myRank || '-'}</h2>
          <p>Look at the host screen for the final results!</p>
        </div>
      </div>
    );
  }

  if ((localState === 'playing' || localState === 'revealed') && currentQuestion) {
    return (
      <div className="container" style={{ display: 'flex', flexDirection: 'column', flex: 1, paddingTop: '1rem' }}>
        
        {/* Top Bar for Player Stats */}
        <div className="top-bar">
          <div>
            <span style={{ color: '#666', fontSize: '1rem' }}>Player</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>{myPlayer?.name || 'You'}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <span style={{ color: '#666', fontSize: '1rem' }}>Rank</span>
            <div style={{ fontSize: '1.8rem', fontWeight: '900', color: 'var(--success)' }}>#{myRank || '-'}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ color: '#666', fontSize: '1rem' }}>Score</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>{myScore}</div>
          </div>
        </div>
        
        <div className="player-layout">
          {/* Main Question Area */}
          <div style={{ flex: 1 }}>
            <div className="center-card" style={{ maxWidth: '100%', margin: '0 0 2rem 0', padding: '2rem' }}>
              <h2 style={{ fontSize: '2rem' }}>{currentQuestion.question_text}</h2>
              
              {/* Progress bar showing 2s pause when revealed */}
              {localState === 'revealed' && (
                <div className="progress-bar-container">
                  <div className="progress-bar-fill"></div>
                </div>
              )}
            </div>

            <div className="grid-2x2" style={{ marginTop: 0 }}>
              {currentQuestion.options.map((opt, i) => {
                let btnClass = `choice-btn color-${i % 4}`;
                
                if (localState === 'revealed' && feedback) {
                  if (opt === feedback.correctAnswer) {
                    btnClass += ' correct-answer';
                  } else if (opt === selectedAnswer) {
                    btnClass += ' wrong-answer';
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
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mini Live Leaderboard Area */}
          <div className="mini-leaderboard">
            <h3>Top Players</h3>
            {leaderboard.slice(0, 5).map((p, i) => (
              <div key={p.token} className="mini-leaderboard-item" style={{ 
                borderLeft: p.token === token ? '6px solid var(--primary)' : 'none',
                backgroundColor: p.token === token ? '#eef6ff' : 'white'
              }}>
                <span>#{i + 1} {p.name} {p.token === token && '(You)'}</span>
                <span style={{ color: 'var(--success)' }}>{p.score}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    );
  }

  // Loading State
  return (
    <div className="center-card">
      <h2 style={{ color: 'var(--primary)' }}>Loading...</h2>
    </div>
  );
}
