/** Formatting helpers shared across screens. */

export function pct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

export function signedPct(delta: number): string {
  const v = Math.round(delta * 100);
  return `${v >= 0 ? '+' : ''}${v}%`;
}

export function compactUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function scoreLabel(score: number | null): string {
  if (score == null) return '—';
  return String(Math.round(score));
}
