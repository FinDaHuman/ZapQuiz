'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { socket } from '@/lib/socket';

type QuestionPayload = {
  questionIndex: number;
  question_text: string;
  options: string[];
};

export default function Play() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<'waiting' | 'running' | 'ended'>('waiting');
  
  // localState manages what the user sees during 'running'
  const [localState, setLocalState] = useState<'loading' | 'playing' | 'feedback'>('loading');
  const [currentQuestion, setCurrentQuestion] = useState<QuestionPayload | null>(null);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; correctAnswer: string } | null>(null);
  const [isOutTabbed, setIsOutTabbed] = useState(false);
  const [score, setScore] = useState(0);

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
      if (data.status === 'running') {
        socket.emit('get_question', { token: savedToken });
      }
    };

    const handleStateUpdate = (data: any) => {
      setStatus(data.status);
      if (data.status === 'running' && status !== 'running') {
        // Game just started
        socket.emit('get_question', { token: savedToken });
      }
    };

    const handleReceiveQuestion = (data: any) => {
      setCurrentQuestion(data);
      setLocalState('playing');
    };

    const handleAnswerResult = (data: any) => {
      setFeedback(data);
      setLocalState('feedback');
      if (data.isCorrect) setScore(s => s + 100);
      
      // Show feedback for 2.5 seconds, then fetch next question automatically
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

  // Anti-Cheat: Tab visibility monitoring
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
    setLocalState('loading'); // Prevent double click
    socket.emit('submit_answer', { token, questionIndex: currentQuestion.questionIndex, answer });
  };

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
      <div className="center-card">
        <h1 className="title">Time's Up!</h1>
        <h2 style={{ color: 'var(--primary)', marginBottom: '1rem', fontSize: '2.5rem' }}>Score: {score}</h2>
        <p>Look at the host screen for the final leaderboard!</p>
      </div>
    );
  }

  // Feedback State
  if (localState === 'feedback' && feedback) {
    return (
      <div className="feedback-container">
        <h1 className="feedback-title" style={{ color: feedback.isCorrect ? 'var(--success)' : 'var(--error)' }}>
          {feedback.isCorrect ? 'Correct! 🎉' : 'Incorrect! 😢'}
        </h1>
        {!feedback.isCorrect && (
          <div className="feedback-subtitle">
            Correct answer: <strong>{feedback.correctAnswer}</strong>
          </div>
        )}
      </div>
    );
  }

  // Playing State
  if (localState === 'playing' && currentQuestion) {
    return (
      <div className="container" style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2 style={{ color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>Score: {score}</h2>
        </div>
        
        <div className="center-card" style={{ maxWidth: '800px', margin: '0 auto', width: '100%', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '2rem' }}>{currentQuestion.question_text}</h2>
        </div>

        <div className="grid-2x2">
          {currentQuestion.options.map((opt, i) => (
            <button 
              key={i} 
              className={`choice-btn color-${i % 4}`}
              onClick={() => submitAnswer(opt)}
            >
              {opt}
            </button>
          ))}
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
