import { io } from 'socket.io-client';

// Use env var or default to local backend
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

export const socket = io(SOCKET_URL, {
  autoConnect: false // We will connect manually when needed
});
