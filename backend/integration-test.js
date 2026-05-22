require('dotenv').config();
const { io } = require('socket.io-client');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const URL = 'http://localhost:3001';

async function runTest() {
  console.log('Starting integration test...');

  const { data: questions, error } = await supabase.from('questions').select('*');
  if (error || !questions || questions.length === 0) {
    console.error('Error fetching questions', error);
    process.exit(1);
  }

  const getCorrectAnswer = (qText) => {
    const q = questions.find(x => x.question_text === qText);
    return q ? q.correct_answer : null;
  };

  const host = io(URL);
  const p1 = io(URL, { autoConnect: false });
  const p2 = io(URL, { autoConnect: false });
  const p3 = io(URL, { autoConnect: false });

  let phase = 0;
  let targetScoreVerified = false;
  let p1AnsCount = 0;

  host.on('connect', () => {
    console.log('Host connected');
    host.emit('join', { token: 'host-view', name: 'Host', password: process.env.HOST_PASSWORD });
    setTimeout(() => {
      host.emit('host_action', { action: 'start', password: process.env.HOST_PASSWORD, duration: 2 });
    }, 500);
  });

  host.on('state_update', (state) => {
    if (state.status === 'running' && phase === 0) {
      phase = 1;
      p1.connect();
      p2.connect();
      p3.connect();
    }

    if (phase === 4) {
      const p1Data = state.leaderboard.find(p => p.token === 'p1');
      const p3Data = state.leaderboard.find(p => p.token === 'p3');

      if (p1Data && p3Data && p1Data.score > 0 && p3Data.score > 0) {
        console.log(`P1 Multiplier: ${p1Data.multiplier}, P3 Multiplier: ${p3Data.multiplier}`);
        if (p1Data.multiplier !== p3Data.multiplier) {
          console.log('Multiplier scaling logic correctly applies differently for 1st place vs 3rd place!');
          phase = 5;
          console.log('Sending tab_switched event for P1...');
          p1.emit('tab_switched', { token: 'p1' });
        }
      }
    } else if (phase === 5) {
      const p1Data = state.leaderboard.find(p => p.token === 'p1');
      if (p1Data && p1Data.multiplier === 1) {
        console.log('Tab switch correctly reset multiplier to 1!');
        console.log('TEST PASSED');
        process.exit(0);
      }
    }
  });

  p1.on('connect', () => p1.emit('join', { token: 'p1', name: 'Player 1' }));
  p2.on('connect', () => p2.emit('join', { token: 'p2', name: 'Player 2' }));
  p3.on('connect', () => p3.emit('join', { token: 'p3', name: 'Player 3' }));

  p1.on('sync', (data) => {
    if (data.status === 'running' && !targetScoreVerified) {
      if (data.targetScore === 4000) {
        console.log('Target score successfully verified as 4000');
        targetScoreVerified = true;
      } else {
        console.error('Target score is', data.targetScore, 'expected 4000');
        process.exit(1);
      }

      setTimeout(() => {
        phase = 2;
        p1.emit('get_question', { token: 'p1' });
      }, 500);
    }
  });

  p1.on('receive_question', (q) => {
    const ans = getCorrectAnswer(q.question_text);
    p1.emit('submit_answer', { token: 'p1', questionIndex: q.questionIndex, answer: ans });
    p1AnsCount++;

    if (p1AnsCount === 1) {
      // After first answer, let P1 get another question to increase lead
      setTimeout(() => {
        p1.emit('get_question', { token: 'p1' });
      }, 500);
    } else if (p1AnsCount === 2) {
      // P1 has 2 correct answers. Now let P3 get a question. P3 is bottom half.
      setTimeout(() => {
        phase = 4;
        p3.emit('get_question', { token: 'p3' });
      }, 500);
    }
  });

  p3.on('receive_question', (q) => {
    const ans = getCorrectAnswer(q.question_text);
    p3.emit('submit_answer', { token: 'p3', questionIndex: q.questionIndex, answer: ans });
  });

  setTimeout(() => {
    console.error('Test timed out');
    process.exit(1);
  }, 10000);
}

runTest();