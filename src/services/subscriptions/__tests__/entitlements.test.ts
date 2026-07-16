import { entitlementsFor, requiredTierFor } from '../entitlements';

describe('entitlements', () => {
  it('free tier gates alerts and personalization', () => {
    const e = entitlementsFor('free');
    expect(e.alertsEnabled).toBe(false);
    expect(e.personalizedFeed).toBe(false);
    expect(e.dailyAiAnalyses).toBe(3);
  });

  it('trader tier is unlimited', () => {
    const e = entitlementsFor('trader');
    expect(e.dailyAiAnalyses).toBe(Infinity);
    expect(e.advancedInsights).toBe(true);
  });

  it('pro unlocks alerts but not advanced insights', () => {
    const e = entitlementsFor('pro');
    expect(e.alertsEnabled).toBe(true);
    expect(e.advancedInsights).toBe(false);
  });

  it('reports the minimum tier that unlocks a feature', () => {
    expect(requiredTierFor('alertsEnabled')).toBe('pro');
    expect(requiredTierFor('advancedInsights')).toBe('trader');
  });
});
