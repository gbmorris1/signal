import { mapKalshiMarket, mapKalshiEvents, type KalshiRawEvent } from '../kalshiMap';
import { titleKeywords, overlap } from '../combinedSource';

const event: KalshiRawEvent = {
  event_ticker: 'FED-24SEP',
  title: 'Will the Fed cut rates in September?',
  category: 'Economics',
  markets: [
    {
      ticker: 'FED-24SEP-C',
      status: 'active',
      last_price_dollars: '0.4300',
      previous_price_dollars: '0.3500',
      volume_24h_fp: '120000.00',
    },
  ],
};

describe('mapKalshiMarket', () => {
  it('maps a nested market with dollar-string prices', () => {
    const m = mapKalshiMarket(event, event.markets![0])!;
    expect(m.id).toBe('kalshi:FED-24SEP-C');
    expect(m.platform).toBe('kalshi');
    expect(m.probability).toBeCloseTo(0.43, 3);
    expect(m.change24h).toBeCloseTo(0.08, 3);
    expect(m.category).toBe('finance');
    expect(m.volume).toBe(120000);
  });

  it('drops non-active markets', () => {
    expect(mapKalshiMarket(event, { ...event.markets![0], status: 'closed' })).toBeNull();
  });

  it('falls back to bid/ask midpoint when no last price', () => {
    const m = mapKalshiMarket(event, {
      ...event.markets![0],
      last_price_dollars: undefined,
      yes_bid_dollars: '0.40',
      yes_ask_dollars: '0.46',
    })!;
    expect(m.probability).toBeCloseTo(0.43, 3);
  });

  it('drops markets with no usable price', () => {
    expect(
      mapKalshiMarket(event, { ...event.markets![0], last_price_dollars: undefined }),
    ).toBeNull();
  });

  it('qualifies titles for multi-outcome events', () => {
    const multi: KalshiRawEvent = {
      title: 'Who will be the next Pope?',
      category: 'World',
      markets: [
        { ticker: 'POPE-A', status: 'active', yes_sub_title: 'Cardinal A', last_price_dollars: '0.08', volume_fp: '500' },
        { ticker: 'POPE-B', status: 'active', yes_sub_title: 'Cardinal B', last_price_dollars: '0.12', volume_fp: '400' },
      ],
    };
    const mapped = mapKalshiEvents([multi]);
    expect(mapped).toHaveLength(2);
    expect(mapped[0].title).toBe('Who will be the next Pope? — Cardinal A');
  });
});

describe('cross-platform title matching', () => {
  it('matches the same question across platforms', () => {
    const a = titleKeywords('Will the Fed cut rates in September?');
    const b = titleKeywords('Fed rate cut by September 2026');
    expect(overlap(a, b)).toBeGreaterThanOrEqual(0.5);
  });

  it('does not match unrelated questions', () => {
    const a = titleKeywords('Will the Fed cut rates in September?');
    const b = titleKeywords('Bitcoin above $100k by end of 2026?');
    expect(overlap(a, b)).toBeLessThan(0.5);
  });
});
