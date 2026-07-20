import { render, screen } from '@testing-library/react-native';
import { EdgeMeter } from '../EdgeMeter';

describe('EdgeMeter', () => {
  it('shows both prices and the disagreement between them', async () => {
    await render(<EdgeMeter marketProbability={0.34} oddiqProbability={0.41} width={300} />);
    expect(screen.getByText('34%')).toBeTruthy();
    expect(screen.getByText('41%')).toBeTruthy();
    expect(screen.getByText('+7 pts')).toBeTruthy();
  });

  it('signs the gap when ODDIQ is BELOW the market', async () => {
    await render(<EdgeMeter marketProbability={0.6} oddiqProbability={0.45} width={300} />);
    expect(screen.getByText('-15 pts')).toBeTruthy();
  });

  it('renders a zero gap without a stray sign', async () => {
    await render(<EdgeMeter marketProbability={0.5} oddiqProbability={0.5} width={300} />);
    expect(screen.getByText('0 pts')).toBeTruthy();
  });

  it('handles the extremes without breaking', async () => {
    await render(<EdgeMeter marketProbability={0.01} oddiqProbability={0.99} width={300} />);
    expect(screen.getByText('+98 pts')).toBeTruthy();
  });
});
