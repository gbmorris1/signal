import type { Alert } from '@/types';

export const MOCK_ALERTS: Alert[] = [
  {
    id: '1',
    marketId: 'polymarket:fed-cut-sept',
    kind: 'ai_shift',
    title: 'AI detected a major market shift',
    body: 'Fed Cut moved from 42% to 51%. Reason: CPI report changed expectations.',
    read: false,
    createdAt: new Date(Date.now() - 3_600_000).toISOString(),
  },
  {
    id: '2',
    marketId: 'polymarket:nba-finals-favorite',
    kind: 'move',
    title: 'NBA favorite probability moved 11%',
    body: 'Sharp move on the NBA Finals favorite market in the last session.',
    read: false,
    createdAt: new Date(Date.now() - 7_200_000).toISOString(),
  },
];
