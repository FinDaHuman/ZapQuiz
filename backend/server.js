require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const gameState = {
  status: 'waiting',
  questions: [],
  players: {}
};

// Helper: create a fresh set of per-game player tracking fields
function freshPlayerTracking() {
  return {
    score: 0,
    outTabbed: false,
    unseenQuestions: [],
    recentQuestions: [],
    answeredQuestions: new Set(),   // prevents re-submission of same question
    currentQuestionIndex: null,     // the question the server actually sent
    totalAnswered: 0,
    totalCorrect: 0,
  };
}

function getLeaderboard() {
  return Object.values(gameState.players)
    .filter(p => p.token !== 'host-view')
    .sort((a, b) => b.score - a.score)
    .map(p => ({
      token: p.token,
      name: p.name,
      score: p.score,
      outTabbed: p.outTabbed,
      totalAnswered: p.totalAnswered,
      totalCorrect: p.totalCorrect,
    }));
}

function broadcastState() {
  io.emit('state_update', {
    status: gameState.status,
    leaderboard: getLeaderboard()
  });
}

io.on('connection', (socket) => {
  socket.on('join', ({ token, name }) => {
    if (!token) return;
    if (!gameState.players[token]) {
      gameState.players[token] = { 
        token, 
        name: name || 'Anonymous', 
        socketId: socket.id,
        ...freshPlayerTracking()
      };
    } else {
      gameState.players[token].socketId = socket.id;
    }

    socket.emit('sync', {
      status: gameState.status,
      leaderboard: getLeaderboard()
    });
    broadcastState();
  });

  socket.on('get_question', ({ token }) => {
    const player = gameState.players[token];
    if (!player || gameState.status !== 'running' || gameState.questions.length === 0) return;

    if (!player.unseenQuestions || player.unseenQuestions.length === 0) {
      player.unseenQuestions = gameState.questions.map((_, i) => i);
    }

    if (!player.recentQuestions) player.recentQuestions = [];

    let available = player.unseenQuestions.filter(i => !player.recentQuestions.includes(i));

    if (available.length === 0) {
      available = player.unseenQuestions;
      if (available.length > 1 && player.recentQuestions.length > 0) {
        const lastQ = player.recentQuestions[player.recentQuestions.length - 1];
        available = available.filter(i => i !== lastQ);
        if (available.length === 0) available = player.unseenQuestions;
      }
    }

    const randIdx = Math.floor(Math.random() * available.length);
    const qIndex = available[randIdx];

    player.unseenQuestions = player.unseenQuestions.filter(i => i !== qIndex);
    
    player.recentQuestions.push(qIndex);
    if (player.recentQuestions.length > 3) {
      player.recentQuestions.shift();
    }

    // Track which question was sent to this player
    player.currentQuestionIndex = qIndex;

    const q = gameState.questions[qIndex];
    socket.emit('receive_question', { questionIndex: qIndex, question_text: q.question_text, options: q.options });
  });

  socket.on('submit_answer', ({ token, questionIndex, answer }) => {
    const player = gameState.players[token];
    if (!player || gameState.status !== 'running') return;

    // Security: reject if this isn't the question we sent them
    if (questionIndex !== player.currentQuestionIndex) return;

    // Security: reject re-submission of an already-answered question
    if (player.answeredQuestions.has(questionIndex)) return;

    const q = gameState.questions[questionIndex];
    if (!q) return;

    // Mark as answered (prevents duplicate scoring)
    player.answeredQuestions.add(questionIndex);
    player.currentQuestionIndex = null;

    // Track answer stats
    player.totalAnswered++;

    const isCorrect = answer === q.correct_answer;
    if (isCorrect) {
      player.score += 100;
      player.totalCorrect++;
      broadcastState();
    }

    // Send correctOptionIndex instead of the raw answer string to prevent cheating
    const correctOptionIndex = q.options.indexOf(q.correct_answer);
    socket.emit('answer_result', { isCorrect, correctOptionIndex });
  });

  socket.on('tab_switched', ({ token }) => {
    const player = gameState.players[token];
    if (player && !player.outTabbed) {
      player.outTabbed = true;
      broadcastState();
    }
  });

  socket.on('host_action', async (data) => {
    const { action } = data;
    if (action === 'start') {
      const { data: qData } = await supabase.from('questions').select('*');
      if (qData) gameState.questions = qData;
      
      gameState.status = 'running';
      // Reset all per-game tracking for every player
      Object.values(gameState.players).forEach(p => {
        Object.assign(p, freshPlayerTracking());
      });
      broadcastState();
    } else if (action === 'end') {
      gameState.status = 'ended';
      broadcastState();

      console.log('Quiz ended. Saving final scores to Supabase...');
      const playersToSave = Object.values(gameState.players)
        .filter(p => p.token !== 'host-view')
        .map(p => ({
          id: p.token,
          display_name: p.name,
          score: p.score,
          out_tabbed: p.outTabbed
        }));

      if (playersToSave.length > 0) {
        supabase.from('players').upsert(playersToSave).then(({ error }) => {
          if (error) console.error('Error saving players:', error);
          else console.log('Successfully saved final scores to Supabase.');
        });
      }
    } else if (action === 'waiting') {
      gameState.status = 'waiting';
      // Reset per-game tracking on lobby reset too (keeps players in lobby)
      Object.values(gameState.players).forEach(p => {
        Object.assign(p, freshPlayerTracking());
      });
      broadcastState();
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => { console.log(`Socket.IO game server running on port ${PORT}`); });
