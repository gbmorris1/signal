import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import MarketDetailScreen from '../market/[id]';
import { generateAnalysis } from '@/services/ai';
import type { AIAnalysis, Market } from '@/types';

const MARKET: Market = {
  id: 'kalshi:NYC',
  externalId: 'NYC',
  platform: 'kalshi',
  title: 'Who wins the NYC mayoral race?',
  category: 'politics',
  probability: 0.34,
  change24h: 0.062,
  volume: 125000,
  aiScore: 78,
  signal: 'opportunity',
  updatedAt: '',
  outcomeLabels: ['Mamdani', 'Other'],
};

let mockDemo = false;
let mockTier: 'free' | 'pro' | 'trader' = 'free';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({ id: 'kalshi:NYC' }),
  Stack: { Screen: () => null },
}));
jest.mock('@/state/auth', () => ({ useAuth: () => ({ demo: mockDemo }) }));
jest.mock('@/state/entitlement', () => ({
  useEntitlement: () => ({
    entitlements: { tier: mockTier, aiDepth: 'shallow', dailyAiAnalyses: 1 },
  }),
}));
jest.mock('@/state/watchlist', () => ({
  useWatchlist: () => ({ has: () => false, toggle: () => true }),
}));
jest.mock('@/services/markets', () => ({
  getMarketSource: () => ({
    getMarket: async () => MARKET,
    getHistory: async () => ({ snapshots: [], synthetic: true }),
    listMarkets: async () => [MARKET],
  }),
  getCombinedSource: () => null,
}));
// Animation-heavy children: the shimmer runs an infinite Animated.loop and the
// chart drives an SVG draw-in, neither of which ever lets act() settle.
jest.mock('@/components/Skeleton', () => ({ Bone: 'Bone', CardSkeleton: 'CardSkeleton' }));
jest.mock('@/components/ProbabilityChart', () => ({ ProbabilityChart: 'ProbabilityChart' }));
jest.mock('@/components/ProbabilityGauge', () => ({ ProbabilityGauge: 'ProbabilityGauge' }));
jest.mock('@/components/EdgeMeter', () => ({ EdgeMeter: 'EdgeMeter' }));
jest.mock('@/components/motion', () => ({
  Enter: ({ children }: { children: unknown }) => children,
  EnterScreen: ({ children }: { children: unknown }) => children,
  AnimatedNumber: 'AnimatedNumber',
}));
jest.mock('@/services/ai', () => ({
  generateAnalysis: jest.fn(),
  isGated: (r: unknown) => (r as { gated?: boolean })?.gated === true,
}));

// One client, garbage-collected immediately and cleared between tests -
// otherwise its cache timers keep the jest process alive after the run.
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
});
afterEach(() => {
  queryClient.clear();
  queryClient.unmount();
});

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('Market detail — AI gating', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDemo = false;
    mockTier = 'free';
  });

  it('offers analysis to a signed-in user', async () => {
    await render(<MarketDetailScreen />, { wrapper });
    expect(await screen.findByText('Explain this move')).toBeTruthy();
    expect(screen.queryByText('Unlock AI analysis')).toBeNull();
  });

  // Demo users must never consume a model call.
  it('blocks a demo user behind sign-up instead of running analysis', async () => {
    mockDemo = true;
    await render(<MarketDetailScreen />, { wrapper });
    expect(await screen.findByText('Unlock AI analysis')).toBeTruthy();
    expect(screen.queryByText('Explain this move')).toBeNull();
  });

  it('still shows the market itself to a demo user', async () => {
    mockDemo = true;
    await render(<MarketDetailScreen />, { wrapper });
    expect(await screen.findByText('Who wins the NYC mayoral race?')).toBeTruthy();
  });
});

const ANALYSIS: AIAnalysis = {
  marketId: 'kalshi:NYC',
  edge: 'The 34% looks low [1].',
  summary: 'Summary text.',
  bullCase: 'Bull.',
  bearCase: 'Bear.',
  whyChanged: 'Why.',
  catalysts: ['A debate on the 4th'],
  riskFactors: ['Thin liquidity'],
  confidence: 'high',
  aiProbabilityEstimate: 0.41,
  sources: [{ title: 'A source', url: 'https://example.com', date: '2026-07-19' }],
  createdAt: new Date().toISOString(),
};

const mockGenerate = generateAnalysis as jest.MockedFunction<typeof generateAnalysis>;

describe('Market detail — quota path', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDemo = false;
    mockTier = 'free';
  });

  // Running out of quota must upsell, not silently fail or show a broken state.
  it('shows the paywall gate with its teaser when the daily quota is spent', async () => {
    mockGenerate.mockResolvedValue({ gated: true, teaser: 'Turnout modelling implies more.' });
    await render(<MarketDetailScreen />, { wrapper });
    fireEvent.press(await screen.findByText('Explain this move'));

    expect(await screen.findByText('Unlock the full report')).toBeTruthy();
    expect(screen.getByText('Turnout modelling implies more.')).toBeTruthy();
    expect(screen.getByText('Try Pro free for 3 days')).toBeTruthy();
  });

  it('renders the analysis when the user is within quota', async () => {
    mockGenerate.mockResolvedValue(ANALYSIS);
    await render(<MarketDetailScreen />, { wrapper });
    fireEvent.press(await screen.findByText('Explain this move'));

    expect(await screen.findByText(/The 34% looks low/)).toBeTruthy();
    expect(screen.getByText('Summary text.')).toBeTruthy();
  });

  it('upsells a free reader on what a higher tier would add', async () => {
    mockGenerate.mockResolvedValue(ANALYSIS);
    await render(<MarketDetailScreen />, { wrapper });
    fireEvent.press(await screen.findByText('Explain this move'));

    expect(await screen.findByText(/YOU'RE SEEING THE QUICK READ/i)).toBeTruthy();
  });

  // Nothing left to sell a Trader - pitching them an upgrade reads as broken.
  it('does NOT upsell a Trader subscriber', async () => {
    mockTier = 'trader';
    mockGenerate.mockResolvedValue(ANALYSIS);
    await render(<MarketDetailScreen />, { wrapper });
    fireEvent.press(await screen.findByText('Explain this move'));

    await waitFor(() => expect(screen.getByText('Summary text.')).toBeTruthy());
    expect(screen.queryByText(/QUICK READ/i)).toBeNull();
    expect(screen.queryByText(/GO DEEPER/i)).toBeNull();
  });
});
