const POINTS_PER_MINUTE = 1000;
const MIN_GAME_MINUTES = 1;
const MAX_GAME_MINUTES = 30;
const DEFAULT_GAME_MINUTES = 3;
const BASE_SCORE = 50;

function getGameDurationMinutes(duration) {
  const parsed = parseInt(duration, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_GAME_MINUTES;
  return Math.min(MAX_GAME_MINUTES, Math.max(MIN_GAME_MINUTES, parsed));
}

function getTargetScore(duration) {
  return getGameDurationMinutes(duration) * POINTS_PER_MINUTE;
}

function getProgressPercent(score, targetScore) {
  if (!Number.isFinite(score) || !Number.isFinite(targetScore) || targetScore <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, (score / targetScore) * 100));
}

function getNextMultiplier({ currentMultiplier = 1, playersAhead = 0, activePlayerCount = 1 }) {
  let maxMultiplier = 2.0;
  let increment = 0.2;

  const isBottomHalf = activePlayerCount > 1 && playersAhead >= Math.floor(activePlayerCount / 2);
  const isFirstPlace = activePlayerCount > 1 && playersAhead === 0;

  if (isFirstPlace) {
    maxMultiplier = 1.5;
    increment = 0.1;
  } else if (isBottomHalf) {
    maxMultiplier = 3.0;
    increment = 0.5;
  }

  return Math.min((currentMultiplier || 1) + increment, maxMultiplier);
}

function scoreAnswer({ player, isCorrect, targetScore, activePlayers }) {
  player.totalAnswered++;

  if (!isCorrect) {
    player.streak = 0;
    player.multiplier = 1;
    return { awardedPoints: 0, reachedTargetScore: false };
  }

  const currentMultiplier = player.multiplier || 1;
  const awardedPoints = Math.round(BASE_SCORE * currentMultiplier);
  player.totalCorrect++;
  player.streak++;
  player.score += awardedPoints;

  const playersAhead = activePlayers.filter(p => p.score > player.score).length;
  player.multiplier = getNextMultiplier({
    currentMultiplier,
    playersAhead,
    activePlayerCount: activePlayers.length,
  });

  return {
    awardedPoints,
    reachedTargetScore: player.score >= targetScore,
  };
}

module.exports = {
  POINTS_PER_MINUTE,
  MIN_GAME_MINUTES,
  MAX_GAME_MINUTES,
  DEFAULT_GAME_MINUTES,
  BASE_SCORE,
  getGameDurationMinutes,
  getTargetScore,
  getProgressPercent,
  getNextMultiplier,
  scoreAnswer,
};
