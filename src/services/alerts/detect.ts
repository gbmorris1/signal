import type { AlertKind } from '@/types';

// Pure move-detection logic shared conceptually with the sync Edge Function.
// A move is "significant" past MOVE_THRESHOLD; a large move becomes a premium
// AI-shift alert. Kept pure so it's unit-testable without a backend.

export const MOVE_THRESHOLD = 0.05; // 5 probability points
export const AI_SHIFT_THRESHOLD = 0.08; // 8 points → premium alert

export interface DetectedAlert {
  kind: AlertKind;
  title: string;
  body: string;
}

export function detectMove(
  marketTitle: string,
  prior: number,
  current: number,
  reason?: string,
): DetectedAlert | null {
  const delta = current - prior;
  if (Math.abs(delta) < MOVE_THRESHOLD) return null;

  const pts = Math.round(delta * 100);
  const priorPct = Math.round(prior * 100);
  const currentPct = Math.round(current * 100);
  const isBig = Math.abs(delta) >= AI_SHIFT_THRESHOLD;

  if (isBig) {
    return {
      kind: 'ai_shift',
      title: 'AI detected a major market shift',
      body: `${marketTitle} moved from ${priorPct}% to ${currentPct}%.${
        reason ? ` Reason: ${reason}` : ''
      }`,
    };
  }
  return {
    kind: 'move',
    title: `${marketTitle} probability moved ${Math.abs(pts)}%`,
    body: `Now ${currentPct}% (${pts >= 0 ? '+' : ''}${pts} points).`,
  };
}
