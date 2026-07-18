import type { EventGroup, Market } from '@/types';

/** A feed row is either a standalone market or a grouped multi-outcome event. */
export type FeedItem = Market | EventGroup;

export function isEventGroup(item: FeedItem): item is EventGroup {
  return (item as EventGroup).kind === 'event';
}

/**
 * Collapse multi-outcome legs (markets sharing an `eventId`) into a single
 * EventGroup, leaving plain markets untouched. Order is preserved by each
 * item's first appearance, so a volume-sorted feed keeps the strongest
 * event/market where it already ranked. A lone leg (only one outcome survived
 * curation) stays a normal market rather than a one-row "group".
 */
export function groupMarkets(markets: Market[]): FeedItem[] {
  const groups = new Map<string, Market[]>();
  const order: Array<{ eventId?: string; market?: Market }> = [];
  const seen = new Set<string>();

  for (const m of markets) {
    if (m.eventId) {
      if (!groups.has(m.eventId)) {
        groups.set(m.eventId, []);
        order.push({ eventId: m.eventId });
      }
      groups.get(m.eventId)!.push(m);
    } else {
      order.push({ market: m });
    }
  }

  const out: FeedItem[] = [];
  for (const slot of order) {
    if (slot.market) {
      out.push(slot.market);
      continue;
    }
    const legs = groups.get(slot.eventId!)!;
    if (seen.has(slot.eventId!)) continue;
    seen.add(slot.eventId!);
    if (legs.length === 1) {
      out.push(legs[0]); // lone outcome — just a market
      continue;
    }
    out.push(toEventGroup(slot.eventId!, legs));
  }
  return out;
}

function toEventGroup(eventId: string, legs: Market[]): EventGroup {
  const outcomes = [...legs].sort((a, b) => b.probability - a.probability);
  return {
    kind: 'event',
    eventId,
    title: outcomes[0].eventTitle ?? outcomes[0].title,
    category: outcomes[0].category,
    outcomes,
    totalVolume: outcomes.reduce((s, m) => s + m.volume, 0),
  };
}
