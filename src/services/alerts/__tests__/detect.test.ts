import { detectMove, MOVE_THRESHOLD } from '../detect';

describe('detectMove', () => {
  it('returns null for a move below threshold', () => {
    expect(detectMove('Fed cut', 0.42, 0.44)).toBeNull();
  });

  it('flags a moderate move as a basic alert', () => {
    const a = detectMove('Fed cut', 0.42, 0.48);
    expect(a?.kind).toBe('move');
    expect(a?.title).toContain('6%');
  });

  it('flags a large move as a premium AI shift with reason', () => {
    const a = detectMove('Fed cut', 0.42, 0.51, 'CPI report changed expectations');
    expect(a?.kind).toBe('ai_shift');
    expect(a?.body).toContain('42% to 51%');
    expect(a?.body).toContain('CPI report');
  });

  it('handles downward moves', () => {
    const a = detectMove('BTC 100k', 0.61, 0.5);
    expect(a?.kind).toBe('ai_shift');
    expect(a?.body).toContain('61% to 50%');
  });

  it('threshold constant is 5 points', () => {
    expect(MOVE_THRESHOLD).toBeCloseTo(0.05);
  });
});
