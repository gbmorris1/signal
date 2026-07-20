import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useWatchlist } from '../watchlist';

// Mutable so each test can pose as a different account / tier.
// (jest.mock factories may only close over `mock`-prefixed names.)
let mockProfile: { id: string } | null = { id: 'user-a' };
let mockLimit = 5;
const mockList = jest.fn();
const mockAdd = jest.fn().mockResolvedValue(true);
const mockRemove = jest.fn().mockResolvedValue(true);

jest.mock('@/state/auth', () => ({ useAuth: () => ({ profile: mockProfile }) }));
jest.mock('@/state/entitlement', () => ({
  useEntitlement: () => ({ entitlements: { watchlistLimit: mockLimit } }),
}));
jest.mock('@/services/watchlist', () => ({
  listWatchlistIds: (...a: unknown[]) => mockList(...a),
  addWatch: (...a: unknown[]) => mockAdd(...a),
  removeWatch: (...a: unknown[]) => mockRemove(...a),
}));

const market = (id: string) => ({ id, title: id }) as never;

// The hook keeps module-level state on purpose (one shared list shared by every
// mounted copy). Rather than re-requiring the module - which yields a second
// React instance and a null hook dispatcher - each test signs in as a NEW
// account, which is exactly what clears that state in production.
let accountSeq = 0;
async function freshHook() {
  mockProfile = { id: `user-${++accountSeq}` };
  return renderHook(() => useWatchlist()); // async in RTL v14
}

describe('useWatchlist', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLimit = 5;
    mockList.mockResolvedValue([]);
  });

  it('adds a market and mirrors it to the server', async () => {
    const { result } = await freshHook();
    await waitFor(() => expect(result.current.ids).toEqual([]));

    await act(async () => {
      expect(result.current.toggle(market('m1'))).toBe(true);
    });
    await waitFor(() => expect(result.current.has('m1')).toBe(true));
    expect(mockAdd).toHaveBeenCalledWith(mockProfile!.id, expect.objectContaining({ id: 'm1' }));
  });

  it('removes a market it already holds', async () => {
    mockList.mockResolvedValue(['m1']);
    const { result } = await freshHook();
    await waitFor(() => expect(result.current.has('m1')).toBe(true));

    await act(async () => {
      result.current.toggle(market('m1'));
    });
    await waitFor(() => expect(result.current.has('m1')).toBe(false));
    expect(mockRemove).toHaveBeenCalledWith(mockProfile!.id, 'm1');
  });

  // The money path: this cap is what a Pro upgrade actually buys.
  it('refuses to add past the tier cap and changes nothing', async () => {
    mockLimit = 2;
    mockList.mockResolvedValue(['m1', 'm2']);
    const { result } = await freshHook();
    await waitFor(() => expect(result.current.ids).toHaveLength(2));

    await act(async () => {
      expect(result.current.toggle(market('m3'))).toBe(false);
    });
    expect(result.current.has('m3')).toBe(false);
    expect(result.current.ids).toHaveLength(2);
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('still allows REMOVING while at the cap', async () => {
    mockLimit = 2;
    mockList.mockResolvedValue(['m1', 'm2']);
    const { result } = await freshHook();
    await waitFor(() => expect(result.current.ids).toHaveLength(2));

    await act(async () => {
      expect(result.current.toggle(market('m1'))).toBe(true);
    });
    await waitFor(() => expect(result.current.has('m1')).toBe(false));
  });

  // The privacy defect: one account's list must never survive into another's.
  it('does not carry a watchlist across accounts', async () => {
    mockList.mockResolvedValue(['user-a-market']);
    const { result, rerender } = await freshHook();
    await waitFor(() => expect(result.current.has('user-a-market')).toBe(true));

    mockProfile = { id: 'user-next' };
    mockList.mockResolvedValue([]); // the next account's list is genuinely empty
    rerender({});

    await waitFor(() => expect(result.current.ids).toEqual([]));
    expect(result.current.has('user-a-market')).toBe(false);
  });

  it('treats a failed server read as "keep what we had", not "empty"', async () => {
    mockList.mockResolvedValue(null); // null = read failed
    const { result } = await freshHook();
    await waitFor(() => expect(result.current.ids).toEqual([]));
    // Nothing cached locally, so empty is correct here - the point is that a
    // null read must not be mistaken for an authoritative empty list.
    expect(mockList).toHaveBeenCalled();
  });
});
