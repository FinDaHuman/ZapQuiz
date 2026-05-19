'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';

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
    <div className="center-card">
      <h1 className="title">Kahoot! Clone</h1>
      <form onSubmit={handleJoin}>
        <input
          type="text"
          className="input-field"
          placeholder="Nickname"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          required
        />
        <button type="submit" className="btn btn-primary">
          Enter
        </button>
      </form>
    </div>
  );
}
