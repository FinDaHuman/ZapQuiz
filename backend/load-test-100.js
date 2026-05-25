require('dotenv').config();
const { io } = require('socket.io-client');
const { randomUUID } = require('crypto');

const URL = process.env.LOAD_BACKEND_URL || process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
const USERS = parseInt(process.env.LOAD_USERS || '100', 10);
const DURATION_SEC = parseInt(process.env.LOAD_DURATION_SEC || '1800', 10);
const JOIN_INTERVAL_MS = parseInt(process.env.LOAD_JOIN_INTERVAL_MS || '50', 10);
const MIN_THINK_MS = parseInt(process.env.LOAD_MIN_THINK_MS || '600', 10);
const MAX_THINK_MS = parseInt(process.env.LOAD_MAX_THINK_MS || '2200', 10);
const START_GAME = process.env.LOAD_START_GAME !== '0';
const HOST_PASSWORD = process.env.HOST_PASSWORD || process.env.LOAD_HOST_PASSWORD;
const GAME_MINUTES = parseInt(process.env.LOAD_GAME_MINUTES || '30', 10);

const metrics = {
  connected: 0,
  joined: 0,
  sync: 0,
  stateUpdate: 0,
  questions: 0,
  answers: 0,
  disconnects: 0,
  connectErrors: 0,
  nameMismatches: 0,
  missingSelf: 0,
  socketErrors: 0,
};

const clients = [];
const pendingQuestions = new Map();
const pendingAnswers = new Map();
const questionLatencies = [];
const answerLatencies = [];
let host = null;
let stopping = false;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomBetween(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

function printMetrics(final = false) {
  const line = {
    users: USERS,
    connected: metrics.connected,
    joined: metrics.joined,
    sync: metrics.sync,
    stateUpdate: metrics.stateUpdate,
    questions: metrics.questions,
    answers: metrics.answers,
    disconnects: metrics.disconnects,
    connectErrors: metrics.connectErrors,
    socketErrors: metrics.socketErrors,
    missingSelf: metrics.missingSelf,
    nameMismatches: metrics.nameMismatches,
    qP50: percentile(questionLatencies, 50),
    qP95: percentile(questionLatencies, 95),
    aP50: percentile(answerLatencies, 50),
    aP95: percentile(answerLatencies, 95),
  };
  console.log(`${final ? 'FINAL' : 'METRICS'} ${JSON.stringify(line)}`);
}

function validateSelf(client, leaderboard) {
  if (!Array.isArray(leaderboard)) return;
  const self = leaderboard.find(p => p.token === client.token);
  if (!self) {
    metrics.missingSelf++;
    return;
  }
  if (self.name !== client.name) {
    metrics.nameMismatches++;
    console.error(`[mismatch] token=${client.token} expected="${client.name}" actual="${self.name}"`);
  }
}

function requestQuestion(client) {
  if (stopping || !client.running || !client.socket.connected) return;
  pendingQuestions.set(client.token, Date.now());
  client.socket.emit('get_question');
}

function createClient(index) {
  const token = `load-${Date.now()}-${index}-${randomUUID()}`;
  const name = `Load User ${String(index + 1).padStart(3, '0')}`;
  const socket = io(URL, {
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 5,
    timeout: 10000,
    transports: ['websocket'],
  });
  const client = { index, token, name, socket, running: false };

  socket.on('connect', () => {
    metrics.connected++;
    socket.emit('join', { token, name });
  });

  socket.on('connect_error', err => {
    metrics.connectErrors++;
    console.error(`[connect_error] ${index}: ${err.message}`);
  });

  socket.on('error', err => {
    metrics.socketErrors++;
    console.error(`[socket_error] ${index}: ${err?.message || err}`);
  });

  socket.on('disconnect', () => {
    metrics.disconnects++;
  });

  socket.on('sync', data => {
    metrics.sync++;
    metrics.joined++;
    validateSelf(client, data.leaderboard);
    if (data.status === 'running') {
      client.running = true;
      requestQuestion(client);
    }
  });

  socket.on('state_update', data => {
    metrics.stateUpdate++;
    validateSelf(client, data.leaderboard);
    const wasRunning = client.running;
    client.running = data.status === 'running';
    if (client.running && !wasRunning) requestQuestion(client);
  });

  socket.on('receive_question', question => {
    metrics.questions++;
    const startedAt = pendingQuestions.get(client.token);
    if (startedAt) {
      questionLatencies.push(Date.now() - startedAt);
      pendingQuestions.delete(client.token);
    }
    const options = Array.isArray(question.options) ? question.options : [];
    const answer = options.length > 0 ? options[randomBetween(0, options.length - 1)] : '';
    pendingAnswers.set(client.token, Date.now());
    setTimeout(() => {
      if (!stopping && client.running && socket.connected) {
        socket.emit('submit_answer', { questionIndex: question.questionIndex, answer });
      }
    }, randomBetween(MIN_THINK_MS, MAX_THINK_MS));
  });

  socket.on('answer_result', () => {
    metrics.answers++;
    const startedAt = pendingAnswers.get(client.token);
    if (startedAt) {
      answerLatencies.push(Date.now() - startedAt);
      pendingAnswers.delete(client.token);
    }
    setTimeout(() => requestQuestion(client), randomBetween(MIN_THINK_MS, MAX_THINK_MS));
  });

  return client;
}

async function main() {
  console.log(`Load test target=${URL} users=${USERS} duration=${DURATION_SEC}s`);
  console.log('Use LOAD_DURATION_SEC=60 for smoke tests; default is 30 minutes.');

  if (START_GAME) {
    if (!HOST_PASSWORD) {
      console.error('LOAD_START_GAME is enabled, but HOST_PASSWORD or LOAD_HOST_PASSWORD is missing.');
      process.exit(1);
    }
    host = io(URL, { autoConnect: false, transports: ['websocket'], timeout: 10000 });
    host.on('connect', () => {
      host.emit('join', { token: 'host-view', name: 'Load Host', password: HOST_PASSWORD });
    });
    host.on('sync', () => {
      host.emit('host_action', { action: 'waiting', password: HOST_PASSWORD });
      setTimeout(() => {
        host.emit('host_action', { action: 'start', password: HOST_PASSWORD, duration: GAME_MINUTES });
      }, 1000);
    });
    host.on('auth_error', data => {
      console.error(`[host_auth_error] ${data.message}`);
      process.exit(1);
    });
    host.connect();
    await sleep(1500);
  }

  for (let i = 0; i < USERS; i++) {
    const client = createClient(i);
    clients.push(client);
    client.socket.connect();
    await sleep(JOIN_INTERVAL_MS);
  }

  const reportInterval = setInterval(() => printMetrics(false), 10000);
  await sleep(DURATION_SEC * 1000);
  stopping = true;
  clearInterval(reportInterval);

  printMetrics(true);
  clients.forEach(client => client.socket.disconnect());
  if (host) host.disconnect();

  if (metrics.connectErrors > 0 || metrics.nameMismatches > 0 || metrics.missingSelf > USERS) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
