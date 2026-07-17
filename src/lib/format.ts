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
  if (score == null) return '–';
  return String(Math.round(score));
}

/**
 * Public web URL for the exact market. We link to polymarket.com/market/{slug},
 * which resolves to the canonical market page. (We do NOT route to polymarket.us:
 * it's a separate catalog whose slugs don't match the API's, so those links land
 * on the homepage. Jurisdiction eligibility is handled by the confirm dialog.)
 */
export function platformUrl(market: {
  platform: 'polymarket' | 'kalshi';
  externalId: string;
  historyRef?: string;
}): string {
  if (market.platform === 'polymarket') {
    return `https://polymarket.com/market/${market.externalId}`;
  }
  // Kalshi: link to the series page (stable public URL).
  const series = market.historyRef?.split('/')[0] ?? market.externalId.split('-')[0];
  return `https://kalshi.com/markets/${series.toLowerCase()}`;
}
