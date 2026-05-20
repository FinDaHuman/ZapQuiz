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

function broadcastState() {
  io.emit('state_update', {
    status: gameState.status,
    leaderboard: Object.values(gameState.players).sort((a, b) => b.score - a.score)
  });
}

io.on('connection', (socket) => {
  socket.on('join', ({ token, name }) => {
    if (!token) return;
    if (!gameState.players[token]) {
      gameState.players[token] = { token, name: name || 'Anonymous', score: 0, outTabbed: false, socketId: socket.id };
    } else {
      gameState.players[token].socketId = socket.id;
    }

    socket.emit('sync', {
      status: gameState.status,
      leaderboard: Object.values(gameState.players).sort((a, b) => b.score - a.score)
    });
    broadcastState();
  });

  // Blooket-style async loop: players request a random question at their own pace
  socket.on('get_question', ({ token }) => {
    if (gameState.status !== 'running' || gameState.questions.length === 0) return;
    const qIndex = Math.floor(Math.random() * gameState.questions.length);
    const q = gameState.questions[qIndex];
    // Never send the correct answer to the client!
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
      broadcastState(); // Broadcast updated leaderboard instantly
    }

    // Give immediate feedback to the player
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
    const { action } = data;
    if (action === 'start') {
      const { data: qData } = await supabase.from('questions').select('*');
      if (qData) gameState.questions = qData;
      
      gameState.status = 'running';
      Object.values(gameState.players).forEach(p => { p.score = 0; p.outTabbed = false; });
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
