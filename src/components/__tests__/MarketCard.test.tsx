import { render, screen, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { MarketCard } from '../MarketCard';
import type { Market } from '@/types';

function market(over: Partial<Market> = {}): Market {
  return {
    id: 'kalshi:NYC-MAYOR-MAMDANI',
    externalId: 'NYC-MAYOR-MAMDANI',
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
    ...over,
  };
}

describe('MarketCard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the question and the priced outcome', async () => {
    await render(<MarketCard market={market()} />);
    expect(screen.getByText('Who wins the NYC mayoral race?')).toBeTruthy();
    expect(screen.getByText(/Mamdani/)).toBeTruthy();
    expect(screen.getByText(/34%/)).toBeTruthy();
  });

  it('opens that market when tapped', async () => {
    await render(<MarketCard market={market()} />);
    fireEvent.press(screen.getByRole('button'));
    expect(router.push).toHaveBeenCalledWith(
      `/market/${encodeURIComponent('kalshi:NYC-MAYOR-MAMDANI')}`,
    );
  });

  it('surfaces the ranking reason when the feed supplies one', async () => {
    await render(<MarketCard market={market()} reason="Moved +6% · your interest: Politics" />);
    expect(screen.getByText('Moved +6% · your interest: Politics')).toBeTruthy();
  });

  it('omits the delta on a flat market rather than printing +0%', async () => {
    await render(<MarketCard market={market({ change24h: 0.001 })} />);
    expect(screen.queryByText('+0%')).toBeNull();
  });

  it('labels the outcome for a multi-outcome leg, not Yes/No', async () => {
    await render(<MarketCard market={market()} />);
    expect(screen.queryByText(/^Yes/)).toBeNull();
    expect(screen.getByText(/Mamdani/)).toBeTruthy();
  });
});
