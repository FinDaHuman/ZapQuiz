require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' } // Allow frontend to connect
});

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- HARDCODED SINGLE LOBBY STATE ---
const gameState = {
  status: 'waiting', // 'waiting', 'running', 'ended'
  currentQuestionIndex: 0,
  questionEndTime: null,
  questions: [], // Preloaded on start
  players: {} // Map: playerToken -> { token, name, score, outTabbed, hasAnswered }
};

const QUESTION_DURATION_MS = 30000;

// Helper to broadcast state to all clients
function broadcastState() {
  io.emit('state_update', {
    status: gameState.status,
    currentQuestionIndex: gameState.currentQuestionIndex,
    questionEndTime: gameState.questionEndTime,
    // Send players as an array sorted by score
    leaderboard: Object.values(gameState.players).sort((a, b) => b.score - a.score)
  });
}

function broadcastQuestion() {
  const q = gameState.questions[gameState.currentQuestionIndex];
  if (!q) return;

  // STRICT F12 PREVENTION: NEVER SEND THE CORRECT ANSWER TO CLIENTS
  const safeQuestion = {
    question_text: q.question_text,
    options: q.options
  };

  io.emit('question_start', {
    question: safeQuestion,
    questionEndTime: gameState.questionEndTime
  });
}

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // --- PLAYER EVENTS ---
  socket.on('join', ({ token, name }) => {
    if (!token) return;

    // Handle Reconnection or New Join
    if (!gameState.players[token]) {
      gameState.players[token] = {
        token,
        name: name || 'Anonymous',
        score: 0,
        outTabbed: false,
        hasAnswered: false,
        socketId: socket.id
      };
    } else {
      // Reconnect: Update socket ID
      gameState.players[token].socketId = socket.id;
    }

    // Send immediate sync to the joined player
    socket.emit('sync', {
      status: gameState.status,
      leaderboard: Object.values(gameState.players).sort((a, b) => b.score - a.score),
      currentQuestionIndex: gameState.currentQuestionIndex,
      questionEndTime: gameState.questionEndTime
    });

    if (gameState.status === 'running') {
      const q = gameState.questions[gameState.currentQuestionIndex];
      if (q) {
        socket.emit('question_start', {
          question: { question_text: q.question_text, options: q.options },
          questionEndTime: gameState.questionEndTime
        });
      }
    }

    broadcastState(); // Update leaderboard for everyone
  });

  socket.on('submit_answer', ({ token, answer }) => {
    const player = gameState.players[token];
    if (!player || player.hasAnswered || gameState.status !== 'running') return;

    const q = gameState.questions[gameState.currentQuestionIndex];
    if (!q) return;

    player.hasAnswered = true;

    // Server-authoritative logic
    if (answer === q.correct_answer) {
      const timeRemaining = gameState.questionEndTime - Date.now();
      const basePoints = 1000;
      // Speed bonus: up to 500 extra points based on time left
      const speedBonus = timeRemaining > 0 ? Math.floor((timeRemaining / QUESTION_DURATION_MS) * 500) : 0;
      player.score += (basePoints + speedBonus);
    }

    broadcastState();
  });

  socket.on('tab_switched', ({ token }) => {
    const player = gameState.players[token];
    if (player && !player.outTabbed) {
      player.outTabbed = true;
      console.log(`Player ${player.name} tabbed out!`);
      broadcastState();
    }
  });

  // --- HOST EVENTS ---
  socket.on('host_action', async (data) => {
    const { action, index } = data;
    
    if (action === 'start') {
      // PRELOAD QUESTIONS
      console.log('Host starting quiz. Preloading questions...');
      const { data: qData, error } = await supabase.from('questions').select('*').order('id', { ascending: true });
      if (!error && qData) {
        gameState.questions = qData;
      }
      
      gameState.status = 'running';
      gameState.currentQuestionIndex = 0;
      gameState.questionEndTime = Date.now() + QUESTION_DURATION_MS;

      // Reset players' answer states
      Object.values(gameState.players).forEach(p => p.hasAnswered = false);

      broadcastState();
      broadcastQuestion();
    } 
    else if (action === 'next') {
      gameState.status = 'running';
      gameState.currentQuestionIndex = index || 0;
      gameState.questionEndTime = Date.now() + QUESTION_DURATION_MS;

      // Reset players' answer states
      Object.values(gameState.players).forEach(p => p.hasAnswered = false);

      broadcastState();
      broadcastQuestion();
    } 
    else if (action === 'end') {
      gameState.status = 'ended';
      gameState.questionEndTime = null;
      broadcastState();

      // OPTIONAL: Flush final scores to Supabase here
      console.log('Quiz ended. Finalizing...');
    } 
    else if (action === 'waiting') {
      gameState.status = 'waiting';
      gameState.questionEndTime = null;
      broadcastState();
    }
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    // We do NOT remove the player from gameState.players to allow reconnection.
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Socket.IO game server running on port ${PORT}`);
});
