import { groupMarkets, isEventGroup } from '../grouping';
import type { Market } from '@/types';

function mk(id: string, over: Partial<Market> = {}): Market {
  return {
    id,
    externalId: id,
    platform: 'kalshi',
    title: id,
    category: 'politics',
    probability: 0.5,
    change24h: 0,
    volume: 1000,
    aiScore: 50,
    signal: 'neutral',
    updatedAt: '',
    outcomeLabels: ['Yes', 'No'],
    ...over,
  };
}

describe('groupMarkets', () => {
  it('groups legs that share an eventId, ranked by probability', () => {
    const items = groupMarkets([
      mk('kalshi:a', { eventId: 'ev1', eventTitle: 'Who wins?', outcomeLabel: 'A', probability: 0.3 }),
      mk('kalshi:b', { eventId: 'ev1', eventTitle: 'Who wins?', outcomeLabel: 'B', probability: 0.5 }),
    ]);
    expect(items).toHaveLength(1);
    const g = items[0];
    expect(isEventGroup(g)).toBe(true);
    if (isEventGroup(g)) {
      expect(g.title).toBe('Who wins?');
      expect(g.outcomes.map((o) => o.outcomeLabel)).toEqual(['B', 'A']); // prob desc
      expect(g.totalVolume).toBe(2000);
    }
  });

  it('leaves plain binary markets untouched', () => {
    const items = groupMarkets([mk('poly:x', { platform: 'polymarket' })]);
    expect(items).toHaveLength(1);
    expect(isEventGroup(items[0])).toBe(false);
  });

  it('does not group a lone surviving leg', () => {
    const items = groupMarkets([mk('kalshi:solo', { eventId: 'ev2', outcomeLabel: 'Solo' })]);
    expect(items).toHaveLength(1);
    expect(isEventGroup(items[0])).toBe(false);
  });

  it('preserves first-seen order across mixed items', () => {
    const items = groupMarkets([
      mk('poly:first'),
      mk('kalshi:a', { eventId: 'ev1', outcomeLabel: 'A' }),
      mk('poly:mid'),
      mk('kalshi:b', { eventId: 'ev1', outcomeLabel: 'B' }),
      mk('poly:last'),
    ]);
    // ev1 collapses to its first-seen slot (index 1); the second leg is folded in.
    expect(items).toHaveLength(4);
    expect(isEventGroup(items[1])).toBe(true);
    expect((items[0] as Market).id).toBe('poly:first');
    expect((items[2] as Market).id).toBe('poly:mid');
    expect((items[3] as Market).id).toBe('poly:last');
  });
});
