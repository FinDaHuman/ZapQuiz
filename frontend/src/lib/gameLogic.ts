export const DEFAULT_TARGET_SCORE = 1000;

export function getProgressPercent(score: number, targetScore: number): number {
  if (!Number.isFinite(score) || !Number.isFinite(targetScore) || targetScore <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, (score / targetScore) * 100));
}
