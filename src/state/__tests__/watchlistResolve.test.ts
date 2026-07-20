import { resolveWatchlist, watchlistStorageKey } from '../watchlistResolve';

describe('resolveWatchlist', () => {
  it('uses the server list when signed in', () => {
    expect(resolveWatchlist({ signedIn: true, remote: ['a', 'b'], local: ['x'] })).toEqual(['a', 'b']);
  });

  // The privacy defect this guards: an empty remote used to be treated as "no
  // data", so the PREVIOUS account's watchlist survived into the next session.
  it('trusts an empty server list over a stale local one', () => {
    expect(resolveWatchlist({ signedIn: true, remote: [], local: ['someone-elses-market'] })).toEqual([]);
  });

  it('falls back to local only when the read actually failed', () => {
    expect(resolveWatchlist({ signedIn: true, remote: null, local: ['a'] })).toEqual(['a']);
  });

  it('uses the local list when signed out', () => {
    expect(resolveWatchlist({ signedIn: false, remote: null, local: ['a'] })).toEqual(['a']);
  });

  it('ignores any remote list when signed out', () => {
    expect(resolveWatchlist({ signedIn: false, remote: ['leak'], local: [] })).toEqual([]);
  });
});

describe('watchlistStorageKey', () => {
  it('namespaces per account so caches cannot cross', () => {
    expect(watchlistStorageKey('user-a')).not.toBe(watchlistStorageKey('user-b'));
  });
  it('has a distinct anonymous key', () => {
    expect(watchlistStorageKey(null)).not.toBe(watchlistStorageKey('user-a'));
  });
});
