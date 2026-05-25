require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { getGameDurationMinutes, getTargetScore, scoreAnswer } = require('./game-logic');

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
  players: {},
  endTime: null,
  targetScore: 1000
};

let gameTimerInterval = null;

function endGame() {
  if (gameState.status !== 'running') return;
  gameState.status = 'ended';
  if (gameTimerInterval) clearInterval(gameTimerInterval);
  broadcastState(true);

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
}

// Helper: create a fresh set of per-game player tracking fields
function freshPlayerTracking() {
  return {
    score: 0,
    outTabbed: false,
    unseenQuestions: [],
    recentQuestions: [],
    currentQuestionIndex: null,     // the question the server actually sent
    totalAnswered: 0,
    totalCorrect: 0,
    multiplier: 1,
    streak: 0,
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
      multiplier: p.multiplier || 1,
    }));
}

let broadcastTimeout = null;

function broadcastState(immediate = false) {
  const doBroadcast = () => {
    io.emit('state_update', {
      status: gameState.status,
      endTime: gameState.endTime,
      targetScore: gameState.targetScore,
      leaderboard: getLeaderboard()
    });
    broadcastTimeout = null;
  };

  if (immediate) {
    if (broadcastTimeout) clearTimeout(broadcastTimeout);
    doBroadcast();
  } else {
    if (!broadcastTimeout) {
      broadcastTimeout = setTimeout(doBroadcast, 250);
    }
  }
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

    // Prevent massive payload abuse
    if (typeof name === 'string' && name.length > 200) return;

    // Unicode normalize and clean name
    const cleanName = (typeof name === 'string' ? name : '')
      .normalize("NFC")
      .trim()
      .slice(0, 28) || 'Anonymous';

    if (!gameState.players[token]) {
      gameState.players[token] = { 
        token, 
        name: cleanName, 
        socketId: socket.id,
        ...freshPlayerTracking()
      };
    } else {
      gameState.players[token].socketId = socket.id;
    }
    socket.data.token = token;

    socket.emit('sync', {
      status: gameState.status,
      endTime: gameState.endTime,
      targetScore: gameState.targetScore,
      leaderboard: getLeaderboard()
    });
    broadcastState();
  });

  socket.on('get_question', () => {
    const token = socket.data.token;
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

  socket.on('submit_answer', ({ questionIndex, answer }) => {
    const token = socket.data.token;
    const player = gameState.players[token];
    if (!player || gameState.status !== 'running') return;

    // Security: reject if this isn't the question we sent them
    if (questionIndex !== player.currentQuestionIndex) return;

    const q = gameState.questions[questionIndex];
    if (!q) return;

    // Mark as answered (prevents duplicate scoring)
    player.currentQuestionIndex = null;

    const isCorrect = answer === q.correct_answer;
    const activePlayers = Object.values(gameState.players).filter(p => p.token !== 'host-view');
    const { reachedTargetScore } = scoreAnswer({
      player,
      isCorrect,
      targetScore: gameState.targetScore,
      activePlayers,
    });

    // Send correctOptionIndex instead of the raw answer string to prevent cheating
    const correctOptionIndex = q.options.indexOf(q.correct_answer);
    socket.emit('answer_result', { isCorrect, correctOptionIndex });

    if (reachedTargetScore) {
      endGame();
    } else {
      broadcastState();
    }
  });

  socket.on('tab_switched', () => {
    const token = socket.data.token;
    const player = gameState.players[token];
    if (player && !player.outTabbed) {
      player.outTabbed = true;
      player.streak = 0;
      player.multiplier = 1;
      broadcastState();
    }
  });

  socket.on('host_action', async (data) => {
    const { action, password, duration } = data;
    
    if (password !== process.env.HOST_PASSWORD) {
      socket.emit('auth_error', { message: 'Unauthorized action' });
      return;
    }

    if (action === 'start') {
      const { data: qData } = await supabase.from('questions').select('*');
      if (qData) gameState.questions = qData;
      
      gameState.status = 'running';
      gameState.targetScore = getTargetScore(duration);
      const gameDurationMinutes = getGameDurationMinutes(duration);
      gameState.endTime = Date.now() + gameDurationMinutes * 60 * 1000;
      if (gameTimerInterval) clearInterval(gameTimerInterval);
      gameTimerInterval = setInterval(() => {
        if (gameState.status === 'running' && Date.now() >= gameState.endTime) {
          endGame();
        }
      }, 1000);

      // Reset all per-game tracking for every player
      Object.values(gameState.players).forEach(p => {
        Object.assign(p, freshPlayerTracking());
      });
      broadcastState(true);
    } else if (action === 'end') {
      endGame();
    } else if (action === 'waiting') {
      gameState.status = 'waiting';
      gameState.endTime = null;
      if (gameTimerInterval) clearInterval(gameTimerInterval);

      // Capture session tokens BEFORE clearing memory.
      // We need this list to delete only the records that belong to this session —
      // a targeted delete is safer than a full-table wipe.
      // Must happen here: after line `gameState.players = {}` the tokens are gone.
      const sessionTokens = Object.values(gameState.players)
        .filter(p => p.token !== 'host-view')
        .map(p => p.token);

      // Reset lobby: kick all players and clear their data
      const hostPlayer = gameState.players['host-view'];
      gameState.players = {};
      if (hostPlayer) {
        gameState.players['host-view'] = hostPlayer;
      }

      // Notify all clients first. Leaderboard and end-screen UI are driven entirely
      // by in-memory state (never re-read from the DB), so it is safe to delete
      // DB records at any point after this broadcast.
      io.emit('lobby_reset');
      broadcastState(true);

      // Fire-and-forget housekeeping: remove this session's records from the players
      // table so the 500 MB Supabase free-tier limit is not reached over time.
      // Runs after the reset is already complete — never blocks or delays the lobby.
      if (sessionTokens.length > 0) {
        supabase
          .from('players')
          .delete()
          .in('id', sessionTokens)
          .then(({ error }) => {
            if (error) {
              console.error('[Supabase] Failed to clean up player records on lobby reset:', error);
            } else {
              console.log(`[Supabase] Cleaned up ${sessionTokens.length} player record(s) from players table.`);
            }
          });
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => { console.log(`Socket.IO game server running on port ${PORT}`); });
