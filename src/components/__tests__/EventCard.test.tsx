import { render, screen, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { EventCard } from '../EventCard';
import { groupMarkets, isEventGroup } from '@/services/markets/grouping';
import type { EventGroup, Market } from '@/types';

function leg(label: string, probability: number): Market {
  return {
    id: `kalshi:${label}`,
    externalId: label,
    platform: 'kalshi',
    title: `Who wins? · ${label}`,
    category: 'politics',
    probability,
    change24h: 0,
    volume: 1000,
    aiScore: 50,
    signal: 'neutral',
    updatedAt: '',
    outcomeLabels: [label, 'Other'],
    eventId: 'kalshi-event:NYC',
    eventTitle: 'Who wins the NYC mayoral race?',
    outcomeLabel: label,
  };
}

const group = groupMarkets([
  leg('Mamdani', 0.34),
  leg('Cuomo', 0.21),
  leg('Adams', 0.12),
  leg('Sliwa', 0.08),
])[0] as EventGroup;

describe('EventCard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('is built from a real grouped event', () => {
    expect(isEventGroup(group)).toBe(true);
  });

  it('shows the event question once, not once per outcome', async () => {
    await render(<EventCard group={group} />);
    expect(screen.getAllByText('Who wins the NYC mayoral race?')).toHaveLength(1);
  });

  it('ranks the field with the leader first', async () => {
    await render(<EventCard group={group} />);
    expect(screen.getByText('Mamdani')).toBeTruthy();
    expect(screen.getByText('34%')).toBeTruthy();
    expect(screen.getByText('Cuomo')).toBeTruthy();
  });

  it('accounts for outcomes beyond the preview instead of hiding them', async () => {
    await render(<EventCard group={group} />);
    expect(screen.getByText('4 outcomes')).toBeTruthy();
    expect(screen.getByText('+1 more outcome')).toBeTruthy();
  });

  it('opens the event, not an individual leg', async () => {
    await render(<EventCard group={group} />);
    fireEvent.press(screen.getByRole('button'));
    expect(router.push).toHaveBeenCalledWith(
      `/event/${encodeURIComponent('kalshi-event:NYC')}`,
    );
  });
});
