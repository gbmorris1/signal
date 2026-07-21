import {
  matchStats,
  titleKeywords,
  isSameQuestion,
  isSameQuestionStrict,
  outcomeConfirmed,
  SAME_QUESTION_MIN_OVERLAP,
} from '../combinedSource';
import type { Category, Market } from '@/types';

/**
 * Every pair below was produced by the matcher against the LIVE catalogues on
 * 2026-07-20. All but one were false positives shown at the old 0.55 bar, where
 * measured precision was ~8%. They are pinned here because the failure mode is
 * uniquely bad for a research product: another venue's price for a different
 * question, presented as the same question, reads as free money.
 */

function market(title: string, extra: Partial<Market> = {}): Market {
  return {
    id: `x:${title}`,
    externalId: title,
    platform: 'kalshi',
    title,
    category: 'politics' as Category,
    probability: 0.5,
    change24h: 0,
    volume: 1000,
    outcomeLabels: ['Yes', 'No'],
    ...extra,
  } as Market;
}

function pair(aTitle: string, b: Market) {
  const a = market(aTitle, { platform: 'polymarket' });
  return { a, b, s: matchStats(titleKeywords(a.title), titleKeywords(b.title)) };
}

const DEMOCRATS_2028 = 'Will the Democrats win the 2028 US Presidential Election?';

describe('cross-venue matching — measured false positives', () => {
  it('does not pair a question with the COMPLEMENT of itself', () => {
    const { a, b, s } = pair(
      DEMOCRATS_2028,
      market('2028 Presidential Election winner? (Party) · Republican party', {
        eventTitle: '2028 Presidential Election winner? (Party)',
        outcomeLabel: 'Republican party',
      }),
    );
    expect(isSameQuestionStrict(a, b, s)).toBe(false);
  });

  it('does not pair a party question with one candidate’s leg', () => {
    const { a, b, s } = pair(
      DEMOCRATS_2028,
      market('2028 U.S. Presidential Election winner? · Marco Rubio', {
        eventTitle: '2028 U.S. Presidential Election winner?',
        outcomeLabel: 'Marco Rubio',
      }),
    );
    expect(isSameQuestionStrict(a, b, s)).toBe(false);
  });

  it('does not treat a party nomination as winning the election', () => {
    const { a, b, s } = pair(
      'Will Marco Rubio win the 2028 Republican presidential nomination?',
      market('2028 U.S. Presidential Election winner? · Marco Rubio', {
        eventTitle: '2028 U.S. Presidential Election winner?',
        outcomeLabel: 'Marco Rubio',
      }),
    );
    expect(isSameQuestionStrict(a, b, s)).toBe(false);
  });

  it('does not treat one House district as control of the House', () => {
    const { a, b, s } = pair(
      'Will the Democratic Party win the OR-04 House seat?',
      market('2028 House winner · Democratic party', {
        eventTitle: '2028 House winner',
        outcomeLabel: 'Democratic party',
      }),
    );
    expect(isSameQuestionStrict(a, b, s)).toBe(false);
  });

  it('does not pair unrelated questions that share a date token', () => {
    const { a, b, s } = pair(
      'Ukraine agrees to limit size of armed forces before 2027?',
      market('When will Ukraine hold a presidential election? · Before 2027', {
        eventTitle: 'When will Ukraine hold a presidential election?',
        outcomeLabel: 'Before 2027',
      }),
    );
    expect(isSameQuestionStrict(a, b, s)).toBe(false);
  });

  /**
   * The measurement that justifies failing closed: the ONE true pair in the live
   * data scored 0.67 — identical to several false pairs above. A ratio cannot
   * separate them, so the honest outcome is that this pair is rejected too.
   * If that ever changes, it must be because matching became structural, not
   * because the threshold was lowered back into the noise.
   */
  it('scores the true pair no higher than the false ones (why the ratio is unusable)', () => {
    const truth = pair(
      DEMOCRATS_2028,
      market('2028 Presidential Election winner? (Party) · Democratic party', {
        outcomeLabel: 'Democratic party',
      }),
    );
    const complement = pair(
      DEMOCRATS_2028,
      market('2028 Presidential Election winner? (Party) · Republican party', {
        outcomeLabel: 'Republican party',
      }),
    );
    expect(truth.s.minRatio).toBeLessThanOrEqual(complement.s.minRatio);
    expect(truth.s.minRatio).toBeLessThan(SAME_QUESTION_MIN_OVERLAP);
  });
});

describe('outcomeConfirmed', () => {
  it('accepts a plain binary market, which has no outcome to confirm', () => {
    expect(outcomeConfirmed(market('Will the Fed cut in September?'), 'anything')).toBe(true);
  });

  it('accepts a leg whose outcome is named in the other title', () => {
    const leg = market('2028 winner · Marco Rubio', { outcomeLabel: 'Marco Rubio' });
    expect(outcomeConfirmed(leg, 'Will Marco Rubio win the 2028 nomination?')).toBe(true);
  });

  it('rejects a leg whose outcome is absent from the other title', () => {
    const leg = market('2028 winner · Marco Rubio', { outcomeLabel: 'Marco Rubio' });
    expect(outcomeConfirmed(leg, 'Will the Democrats win in 2028?')).toBe(false);
  });
});

describe('isSameQuestion', () => {
  it('still accepts a genuinely identical question', () => {
    const a = titleKeywords('Will Bitcoin reach $150,000 by December 31?');
    const b = titleKeywords('Will Bitcoin reach $150,000 by December 31?');
    expect(isSameQuestion(matchStats(a, b), SAME_QUESTION_MIN_OVERLAP)).toBe(true);
  });

  it('requires more than a single shared distinctive token', () => {
    const a = titleKeywords('Will Bitcoin reach $150,000 by December 31?');
    const b = titleKeywords('Will Bitcoin crash below $20,000 this year?');
    expect(isSameQuestion(matchStats(a, b), SAME_QUESTION_MIN_OVERLAP)).toBe(false);
  });
});
