'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { socket } from '@/lib/socket';

type QuestionPayload = {
  question_text: string;
  options: string[];
};

export default function Play() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<'waiting' | 'running' | 'ended'>('waiting');
  const [currentQuestion, setCurrentQuestion] = useState<QuestionPayload | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [isOutTabbed, setIsOutTabbed] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

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
      if (data.status !== 'running') {
        setCurrentQuestion(null);
      }
    };

    const handleStateUpdate = (data: any) => {
      setStatus(data.status);
      if (data.status !== 'running') {
        setCurrentQuestion(null);
        setHasAnswered(false);
      }
    };

    const handleQuestionStart = (data: any) => {
      setCurrentQuestion(data.question);
      setHasAnswered(false);
      
      // Setup local timer based on authoritative endTime
      if (data.questionEndTime) {
        const calculateTime = () => Math.max(0, Math.ceil((data.questionEndTime - Date.now()) / 1000));
        setTimeLeft(calculateTime());
        
        const interval = setInterval(() => {
          const rem = calculateTime();
          setTimeLeft(rem);
          if (rem <= 0) clearInterval(interval);
        }, 500);
        
        // Clean up interval when question changes or component unmounts
        // (In a fuller app, we'd store the interval ID in a ref to clear it securely)
        (window as any)._questionTimer = interval; 
      }
    };

    socket.on('sync', handleSync);
    socket.on('state_update', handleStateUpdate);
    socket.on('question_start', handleQuestionStart);

    return () => {
      socket.off('sync', handleSync);
      socket.off('state_update', handleStateUpdate);
      socket.off('question_start', handleQuestionStart);
      if ((window as any)._questionTimer) clearInterval((window as any)._questionTimer);
    };
  }, [router]);

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
    if (hasAnswered || !token || !currentQuestion) return;
    setHasAnswered(true);
    socket.emit('submit_answer', { token, answer });
  };

  if (status === 'waiting') {
    return (
      <div className="center-card">
        <h1 className="title">You're in!</h1>
        <p>See your nickname on screen</p>
        <p style={{ marginTop: '1rem', color: '#666' }}>Waiting for host to start...</p>
      </div>
    );
  }

  if (status === 'ended') {
    return (
      <div className="center-card">
        <h1 className="title">Quiz Ended</h1>
        <p>Look at the host screen for the final results!</p>
      </div>
    );
  }

  // Running
  if (hasAnswered) {
    return (
      <div className="center-card" style={{ backgroundColor: 'var(--primary)', color: 'white' }}>
        <h2>Waiting for others...</h2>
      </div>
    );
  }

  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '1rem' }}>
        {currentQuestion?.question_text || 'Loading question...'}
      </h2>
      
      {timeLeft !== null && (
        <h3 style={{ textAlign: 'center', marginBottom: '2rem', color: 'var(--secondary)' }}>
          Time left: {timeLeft}s
        </h3>
      )}

      <div className="grid-2x2">
        {currentQuestion?.options.map((opt, i) => (
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
