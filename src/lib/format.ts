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
 * Public web URL for a market on its home platform, routed by region.
 * US users go to the CFTC-regulated US venues (Kalshi is US-regulated;
 * Polymarket's US entity lives at polymarket.us); international users go to
 * the main sites. Pass the device region ('US', 'GB', …) from expo-localization.
 */
export function platformUrl(
  market: { platform: 'polymarket' | 'kalshi'; externalId: string; historyRef?: string },
  region?: string | null,
): string {
  const isUS = (region ?? '').toUpperCase() === 'US';
  if (market.platform === 'polymarket') {
    const host = isUS ? 'https://polymarket.us' : 'https://polymarket.com';
    return `${host}/market/${market.externalId}`;
  }
  // Kalshi is US-regulated; the same site serves both, linked to the series page.
  const series = market.historyRef?.split('/')[0] ?? market.externalId.split('-')[0];
  return `https://kalshi.com/markets/${series.toLowerCase()}`;
}
