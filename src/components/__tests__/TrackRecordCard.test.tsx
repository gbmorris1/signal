import { render, screen, waitFor } from '@testing-library/react-native';
import { TrackRecordCard } from '../TrackRecordCard';
import { getTrackRecord, TRACK_RECORD_PROVEN_MIN } from '@/services/trackRecord';

jest.mock('@/services/trackRecord', () => ({
  ...jest.requireActual('@/services/trackRecord'),
  getTrackRecord: jest.fn(),
}));
const mockGet = getTrackRecord as jest.MockedFunction<typeof getTrackRecord>;

describe('TrackRecordCard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('headlines the hit rate once the sample is credible', async () => {
    mockGet.mockResolvedValue({
      resolvedPredictions: TRACK_RECORD_PROVEN_MIN + 5,
      beatMarketPct: 63.2,
      brierEdge: 0.02,
    });
    await render(<TrackRecordCard />);
    await waitFor(() => expect(screen.getByText('63%')).toBeTruthy());
    expect(screen.getByText(/beat the market/)).toBeTruthy();
  });

  // The claim must never outrun the evidence: below the threshold we sell the
  // mechanism, not a percentage a reader would take as proven.
  it('does NOT headline a percentage on a thin sample', async () => {
    mockGet.mockResolvedValue({
      resolvedPredictions: 3,
      beatMarketPct: 100,
      brierEdge: 0.5,
    });
    await render(<TrackRecordCard />);
    await waitFor(() => expect(screen.getByText('Every call, scored.')).toBeTruthy());
    expect(screen.queryByText('100%')).toBeNull();
    expect(screen.getByText(/3 scored so far/)).toBeTruthy();
  });

  it('explains the mechanism when nothing has resolved yet', async () => {
    mockGet.mockResolvedValue(null);
    await render(<TrackRecordCard />);
    await waitFor(() => expect(screen.getByText('Every call, scored.')).toBeTruthy());
    expect(screen.queryByText(/scored so far/)).toBeNull();
  });

  it('always claims the record is verified', async () => {
    mockGet.mockResolvedValue(null);
    await render(<TrackRecordCard />);
    expect(screen.getByText('The verified record')).toBeTruthy();
  });
});
