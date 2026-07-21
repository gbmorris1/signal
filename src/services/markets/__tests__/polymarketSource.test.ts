import { PolymarketSource } from '../polymarketSource';

/**
 * The browse endpoint only ever returns the top markets by volume. These tests pin
 * the behaviour that makes everything outside that window reachable — by search and
 * by id — because without it a real market a user types in is indistinguishable
 * from one that doesn't exist.
 */

function raw(slug: string, question: string, price = '0.42') {
  return {
    slug,
    question,
    outcomePrices: `["${price}", "${1 - Number(price)}"]`,
    volumeNum: 10_000,
    oneDayPriceChange: 0.01,
    active: true,
    closed: false,
  };
}

const CATALOG = [raw('fed-cut-september', 'Will the Fed cut rates in September?')];

interface Routes {
  catalog?: unknown;
  search?: unknown;
  slug?: unknown;
}

/** Routes by URL so each test states only the endpoints it cares about. */
function mockFetch(routes: Routes) {
  const calls: string[] = [];
  const fn = jest.fn(async (url: string) => {
    calls.push(url);
    const pick = url.includes('/public-search')
      ? routes.search
      : url.includes('slug=')
        ? routes.slug
        : routes.catalog;
    if (pick === undefined) return { ok: false, status: 500, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => pick };
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  global.fetch = fn as any;
  return { calls };
}

const searchPayload = (markets: unknown[]) => ({ events: [{ markets }] });

afterEach(() => {
  jest.restoreAllMocks();
});

describe('PolymarketSource.listMarkets', () => {
  it('returns the browse catalogue and never searches when there is no query', async () => {
    const { calls } = mockFetch({ catalog: CATALOG });
    const out = await new PolymarketSource().listMarkets();
    expect(out).toHaveLength(1);
    expect(calls.some((u) => u.includes('public-search'))).toBe(false);
  });

  it('reaches markets outside the browse window when searching', async () => {
    mockFetch({
      catalog: CATALOG,
      search: searchPayload([raw('eth-3000-july', 'Will Ethereum be under $3000?')]),
    });
    const out = await new PolymarketSource().listMarkets({ query: 'ethereum' });
    expect(out.map((m) => m.id)).toContain('polymarket:eth-3000-july');
  });

  it('keeps catalogue matches ahead of remote ones and never duplicates', async () => {
    mockFetch({
      catalog: CATALOG,
      // The same market comes back from search as well as the catalogue.
      search: searchPayload([raw('fed-cut-september', 'Will the Fed cut rates in September?')]),
    });
    const out = await new PolymarketSource().listMarkets({ query: 'fed' });
    expect(out.filter((m) => m.id === 'polymarket:fed-cut-september')).toHaveLength(1);
    expect(out[0].id).toBe('polymarket:fed-cut-september');
  });

  /**
   * Polymarket's search matches on more than the title, so remote hits must not be
   * re-filtered by substring here — that would discard the markets we went to find.
   */
  it('does not require remote hits to contain the query in their title', async () => {
    mockFetch({
      catalog: CATALOG,
      search: searchPayload([raw('potus-2028', 'Who wins the next presidential election?')]),
    });
    const out = await new PolymarketSource().listMarkets({ query: 'biden' });
    expect(out.map((m) => m.id)).toContain('polymarket:potus-2028');
  });

  it('still returns catalogue matches when search fails', async () => {
    mockFetch({ catalog: CATALOG }); // no search route → 500
    const out = await new PolymarketSource().listMarkets({ query: 'fed' });
    expect(out.map((m) => m.id)).toEqual(['polymarket:fed-cut-september']);
  });

  it('drops settled and closed markets returned by search', async () => {
    mockFetch({
      catalog: CATALOG,
      search: searchPayload([
        { ...raw('done-market', 'Already resolved?'), closed: true },
        raw('settled-market', 'Effectively decided?', '0.999'),
      ]),
    });
    const out = await new PolymarketSource().listMarkets({ query: 'resolved' });
    expect(out.map((m) => m.id)).not.toContain('polymarket:done-market');
    expect(out.map((m) => m.id)).not.toContain('polymarket:settled-market');
  });

  it('applies the category filter to remote hits too', async () => {
    mockFetch({
      catalog: CATALOG,
      search: searchPayload([raw('eth-3000-july', 'Will Ethereum be under $3000?')]),
    });
    const out = await new PolymarketSource().listMarkets({ query: 'eth', category: 'sports' });
    expect(out).toHaveLength(0);
  });
});

describe('PolymarketSource.getMarket', () => {
  it('fetches by slug when the id is outside the browse window', async () => {
    mockFetch({ catalog: CATALOG, slug: [raw('obscure-market', 'Some niche question?')] });
    const out = await new PolymarketSource().getMarket('polymarket:obscure-market');
    expect(out?.id).toBe('polymarket:obscure-market');
  });

  it('returns null when the market genuinely does not exist', async () => {
    mockFetch({ catalog: CATALOG, slug: [] });
    expect(await new PolymarketSource().getMarket('polymarket:nope')).toBeNull();
  });

  it('serves a searched market from memory without refetching it', async () => {
    const { calls } = mockFetch({
      catalog: CATALOG,
      search: searchPayload([raw('eth-3000-july', 'Will Ethereum be under $3000?')]),
    });
    const source = new PolymarketSource();
    await source.listMarkets({ query: 'ethereum' });
    const before = calls.length;
    const out = await source.getMarket('polymarket:eth-3000-july');
    expect(out?.id).toBe('polymarket:eth-3000-july');
    expect(calls.length).toBe(before);
  });

  it('does not let a searched market stand in for the browse catalogue', async () => {
    const source = new PolymarketSource();
    mockFetch({
      catalog: CATALOG,
      search: searchPayload([raw('eth-3000-july', 'Will Ethereum be under $3000?')]),
    });
    await source.listMarkets({ query: 'ethereum' });
    // Catalogue now fails; the fallback must be the last good CATALOG, not the
    // one-off market that search happened to resolve.
    mockFetch({ search: searchPayload([]) });
    const out = await source.listMarkets();
    expect(out.map((m) => m.id)).toEqual(['polymarket:fed-cut-september']);
  });
});
