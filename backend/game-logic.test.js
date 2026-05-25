const test = require('node:test');
const assert = require('node:assert/strict');
const {
  BASE_SCORE,
  DEFAULT_GAME_MINUTES,
  MAX_GAME_MINUTES,
  getGameDurationMinutes,
  getTargetScore,
  getProgressPercent,
  getNextMultiplier,
  scoreAnswer,
} = require('./game-logic');

function player(overrides = {}) {
  return {
    token: 'p',
    score: 0,
    totalAnswered: 0,
    totalCorrect: 0,
    streak: 0,
    multiplier: 1,
    ...overrides,
  };
}

test('duration is clamped to the supported 1-30 minute range', () => {
  assert.equal(getGameDurationMinutes(undefined), DEFAULT_GAME_MINUTES);
  assert.equal(getGameDurationMinutes('bad'), DEFAULT_GAME_MINUTES);
  assert.equal(getGameDurationMinutes(0), 1);
  assert.equal(getGameDurationMinutes(-10), 1);
  assert.equal(getGameDurationMinutes(1), 1);
  assert.equal(getGameDurationMinutes(30), 30);
  assert.equal(getGameDurationMinutes(31), MAX_GAME_MINUTES);
});

test('target score is exactly 1000 points per minute', () => {
  assert.equal(getTargetScore(1), 1000);
  assert.equal(getTargetScore(2), 2000);
  assert.equal(getTargetScore(30), 30000);
  assert.equal(getTargetScore(31), 30000);
  assert.equal(getTargetScore('bad'), 3000);
});

test('progress percent always represents score against the goal', () => {
  assert.equal(getProgressPercent(0, 1000), 0);
  assert.equal(getProgressPercent(250, 1000), 25);
  assert.equal(getProgressPercent(1000, 1000), 100);
  assert.equal(getProgressPercent(1500, 1000), 100);
  assert.equal(getProgressPercent(-50, 1000), 0);
  assert.equal(getProgressPercent(50, 0), 0);
  assert.equal(getProgressPercent(Number.NaN, 1000), 0);
});

test('next multiplier applies normal, leader, and catch-up rules', () => {
  assert.equal(getNextMultiplier({ currentMultiplier: 1, playersAhead: 0, activePlayerCount: 1 }), 1.2);
  assert.equal(getNextMultiplier({ currentMultiplier: 1, playersAhead: 0, activePlayerCount: 3 }), 1.1);
  assert.equal(getNextMultiplier({ currentMultiplier: 1.5, playersAhead: 0, activePlayerCount: 3 }), 1.5);
  assert.equal(getNextMultiplier({ currentMultiplier: 1, playersAhead: 1, activePlayerCount: 3 }), 1.5);
  assert.equal(getNextMultiplier({ currentMultiplier: 2.8, playersAhead: 2, activePlayerCount: 4 }), 3);
});

test('correct answer awards points with current multiplier before updating multiplier', () => {
  const p = player();
  const result = scoreAnswer({ player: p, isCorrect: true, targetScore: 1000, activePlayers: [p] });

  assert.deepEqual(result, { awardedPoints: BASE_SCORE, reachedTargetScore: false });
  assert.equal(p.score, 50);
  assert.equal(p.totalAnswered, 1);
  assert.equal(p.totalCorrect, 1);
  assert.equal(p.streak, 1);
  assert.equal(p.multiplier, 1.2);
});

test('correct answer uses rounded multiplier score', () => {
  const p = player({ multiplier: 1.5 });
  const result = scoreAnswer({ player: p, isCorrect: true, targetScore: 1000, activePlayers: [p] });

  assert.equal(result.awardedPoints, 75);
  assert.equal(p.score, 75);
});

test('incorrect answer records attempt and resets streak and multiplier without scoring', () => {
  const p = player({ score: 120, streak: 3, multiplier: 2.2, totalCorrect: 2 });
  const result = scoreAnswer({ player: p, isCorrect: false, targetScore: 1000, activePlayers: [p] });

  assert.deepEqual(result, { awardedPoints: 0, reachedTargetScore: false });
  assert.equal(p.score, 120);
  assert.equal(p.totalAnswered, 1);
  assert.equal(p.totalCorrect, 2);
  assert.equal(p.streak, 0);
  assert.equal(p.multiplier, 1);
});

test('reaching or exceeding target score is reported only after a correct answer', () => {
  const exact = player({ score: 950 });
  const over = player({ score: 990, multiplier: 1.2 });
  const wrong = player({ score: 1000 });

  assert.equal(scoreAnswer({ player: exact, isCorrect: true, targetScore: 1000, activePlayers: [exact] }).reachedTargetScore, true);
  assert.equal(scoreAnswer({ player: over, isCorrect: true, targetScore: 1000, activePlayers: [over] }).reachedTargetScore, true);
  assert.equal(scoreAnswer({ player: wrong, isCorrect: false, targetScore: 1000, activePlayers: [wrong] }).reachedTargetScore, false);
});

test('leader gets anti-snowball multiplier while lower-ranked players get catch-up multiplier', () => {
  const leader = player({ token: 'leader', score: 200, multiplier: 1 });
  const middle = player({ token: 'middle', score: 100, multiplier: 1 });
  const lower = player({ token: 'lower', score: 0, multiplier: 1 });
  const activePlayers = [leader, middle, lower];

  scoreAnswer({ player: leader, isCorrect: true, targetScore: 1000, activePlayers });
  scoreAnswer({ player: lower, isCorrect: true, targetScore: 1000, activePlayers });

  assert.equal(leader.multiplier, 1.1);
  assert.equal(lower.multiplier, 1.5);
});
