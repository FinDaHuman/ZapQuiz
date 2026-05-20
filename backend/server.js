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

function getLeaderboard() {
  return Object.values(gameState.players)
    .filter(p => p.token !== 'host-view')
    .sort((a, b) => b.score - a.score);
}

function broadcastState() {
  io.emit('state_update', {
    status: gameState.status,
    leaderboard: getLeaderboard()
  });
}

io.on('connection', (socket) => {
  socket.on('join', ({ token, name, password }) => {
    if (!token) return;
    
    if (token === 'host-view') {
      if (password !== process.env.HOST_PASSWORD) {
        socket.emit('auth_error', { message: 'Invalid host password' });
        return;
      }
    }

    if (!gameState.players[token]) {
      gameState.players[token] = { 
        token, 
        name: name || 'Anonymous', 
        score: 0, 
        outTabbed: false, 
        socketId: socket.id,
        unseenQuestions: [],
        recentQuestions: []
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

    const q = gameState.questions[qIndex];
    socket.emit('receive_question', { questionIndex: qIndex, question_text: q.question_text, options: q.options });
  });

  socket.on('submit_answer', ({ token, questionIndex, answer }) => {
    const player = gameState.players[token];
    if (!player || gameState.status !== 'running') return;

    const q = gameState.questions[questionIndex];
    if (!q) return;

    const isCorrect = answer === q.correct_answer;
    if (isCorrect) {
      player.score += 100;
      broadcastState();
    }

    socket.emit('answer_result', { isCorrect, correctAnswer: q.correct_answer });
  });

  socket.on('tab_switched', ({ token }) => {
    const player = gameState.players[token];
    if (player && !player.outTabbed) {
      player.outTabbed = true;
      broadcastState();
    }
  });

  socket.on('host_action', async (data) => {
    const { action, password } = data;
    
    if (password !== process.env.HOST_PASSWORD) {
      socket.emit('auth_error', { message: 'Unauthorized action' });
      return;
    }

    if (action === 'start') {
      const { data: qData } = await supabase.from('questions').select('*');
      if (qData) gameState.questions = qData;
      
      gameState.status = 'running';
      Object.values(gameState.players).forEach(p => { 
        p.score = 0; 
        p.outTabbed = false; 
        p.unseenQuestions = [];
        p.recentQuestions = [];
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
      broadcastState();
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => { console.log(`Socket.IO game server running on port ${PORT}`); });
