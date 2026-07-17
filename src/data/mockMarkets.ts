import type { Market, MarketSnapshot, AIAnalysis } from '@/types';

const now = new Date().toISOString();

export const MOCK_MARKETS: Market[] = [
  {
    id: 'polymarket:fed-cut-sept',
    externalId: 'fed-cut-sept',
    platform: 'polymarket',
    title: 'Will the Fed cut rates in September?',
    category: 'finance',
    probability: 0.43,
    change24h: 0.08,
    volume: 4_820_000,
    aiScore: 78,
    signal: 'opportunity',
    updatedAt: now,
    outcomeLabels: ['Yes', 'No'] as [string, string],
    description:
      'Resolves Yes if the Federal Reserve announces a cut to the federal funds target rate at its September FOMC meeting. Resolves No if rates are held or raised.',
  },
  {
    id: 'polymarket:btc-100k-2026',
    externalId: 'btc-100k-2026',
    platform: 'polymarket',
    title: 'Bitcoin above $100k by end of 2026?',
    category: 'crypto',
    probability: 0.61,
    change24h: -0.03,
    volume: 9_140_000,
    aiScore: 64,
    signal: 'watch',
    updatedAt: now,
    outcomeLabels: ['Yes', 'No'] as [string, string],
  },
  {
    id: 'polymarket:us-election-turnout',
    externalId: 'us-election-turnout',
    platform: 'polymarket',
    title: 'Record voter turnout in next US election?',
    category: 'politics',
    probability: 0.37,
    change24h: 0.02,
    volume: 2_310_000,
    aiScore: 51,
    signal: 'neutral',
    updatedAt: now,
    outcomeLabels: ['Yes', 'No'] as [string, string],
  },
  {
    id: 'polymarket:nba-finals-favorite',
    externalId: 'nba-finals-favorite',
    platform: 'polymarket',
    title: 'Will the favorite win the NBA Finals?',
    category: 'sports',
    probability: 0.55,
    change24h: 0.11,
    volume: 1_760_000,
    aiScore: 72,
    signal: 'opportunity',
    updatedAt: now,
    outcomeLabels: ['Yes', 'No'] as [string, string],
  },
  {
    id: 'polymarket:ai-regulation-2026',
    externalId: 'ai-regulation-2026',
    platform: 'polymarket',
    title: 'Major AI regulation passed in 2026?',
    category: 'technology',
    probability: 0.29,
    change24h: -0.06,
    volume: 980_000,
    aiScore: 44,
    signal: 'caution',
    updatedAt: now,
    outcomeLabels: ['Yes', 'No'] as [string, string],
  },
  {
    id: 'polymarket:global-ceasefire',
    externalId: 'global-ceasefire',
    platform: 'polymarket',
    title: 'Major ceasefire announced this quarter?',
    category: 'world',
    probability: 0.18,
    change24h: 0.04,
    volume: 1_120_000,
    aiScore: 58,
    signal: 'watch',
    updatedAt: now,
    outcomeLabels: ['Yes', 'No'] as [string, string],
  },
];

// Deterministic pseudo-history so charts render without a backend.
export function mockHistory(marketId: string): MarketSnapshot[] {
  const market = MOCK_MARKETS.find((m) => m.id === marketId);
  const end = market?.probability ?? 0.5;
  const start = end - (market?.change24h ?? 0) * 3;
  const points = 24;
  return Array.from({ length: points }, (_, i) => {
    const t = i / (points - 1);
    const wobble = Math.sin(i * 1.3) * 0.02;
    const p = Math.min(0.98, Math.max(0.02, start + (end - start) * t + wobble));
    return {
      probability: Number(p.toFixed(3)),
      volume: (market?.volume ?? 1_000_000) * (0.6 + t * 0.4),
      capturedAt: new Date(Date.now() - (points - 1 - i) * 3_600_000).toISOString(),
    };
  });
}

export const MOCK_ANALYSIS: Record<string, AIAnalysis> = {
  'polymarket:fed-cut-sept': {
    marketId: 'polymarket:fed-cut-sept',
    summary:
      'Odds of a September cut jumped after a softer-than-expected inflation print reset rate expectations.',
    bullCase:
      'Cooling CPI and a weakening labor market give the Fed room to ease; futures markets have already repriced.',
    bearCase:
      'Sticky services inflation and strong consumer spending could keep the Fed on hold through the fall.',
    whyChanged:
      'A new inflation report came in below consensus, shifting probability up 8 points in a single session.',
    catalysts: ['Next CPI release', 'FOMC dot plot', 'Monthly jobs report'],
    riskFactors: ['Inflation re-acceleration', 'Hawkish Fed commentary', 'Oil price shock'],
    confidence: 'medium',
    aiProbabilityEstimate: 0.46,
    createdAt: now,
  },
};
