// Core domain types for Signal.

export type Platform = 'polymarket' | 'kalshi';
export type Category = 'politics' | 'finance' | 'crypto' | 'sports' | 'world' | 'technology';
export type AISignal = 'opportunity' | 'watch' | 'neutral' | 'caution';
export type Confidence = 'low' | 'medium' | 'high';
export type PlanTier = 'free' | 'pro' | 'trader';
export type AlertKind = 'move' | 'ai_shift' | 'volume_spike';
export type ExperienceLevel = 'beginner' | 'active' | 'professional';

export interface UserPreferences {
  interests: Category[];
  experience: ExperienceLevel;
  onboarded: boolean;
}

export interface Market {
  id: string;
  externalId: string;
  platform: Platform;
  title: string;
  category: Category;
  probability: number; // 0..1
  change24h: number; // probability points, signed
  volume: number;
  aiScore: number | null; // 0..100
  signal: AISignal;
  updatedAt: string;
  /** Opaque reference for fetching real price history (platform-specific). */
  historyRef?: string;
  /**
   * The two outcome names. `probability` always refers to the FIRST outcome.
   * Usually ['Yes','No'], but e.g. ['Norris','Verstappen'] on head-to-heads.
   */
  outcomeLabels: [string, string];
  /** Plain-language explanation of the market and its resolution rules. */
  description?: string;
  /**
   * Multi-outcome grouping. When several markets are outcomes of one event
   * (e.g. each candidate in a race), they share `eventId` + `eventTitle`, and
   * `outcomeLabel` is this leg's specific outcome ("Mamdani"). Absent for plain
   * binary markets. The market stays its own addressable unit; these only drive
   * grouped display.
   */
  eventId?: string;
  eventTitle?: string;
  outcomeLabel?: string;
}

/** A multi-outcome event: several outcome markets grouped under one question. */
export interface EventGroup {
  kind: 'event';
  eventId: string;
  title: string;
  category: Category;
  /** Outcome markets, ranked by probability descending. */
  outcomes: Market[];
  totalVolume: number;
}

export interface MarketSnapshot {
  probability: number;
  volume: number;
  capturedAt: string;
}

export interface MarketHistory {
  snapshots: MarketSnapshot[];
  /** True when the curve is synthesized (no real price feed available). */
  synthetic: boolean;
}

export interface AISource {
  title: string;
  url: string;
  date?: string | null;
}

export interface AIAnalysis {
  marketId: string;
  edge: string; // the opinionated headline thesis
  summary: string;
  bullCase: string;
  bearCase: string;
  whyChanged: string;
  catalysts: string[];
  riskFactors: string[];
  confidence: Confidence;
  aiProbabilityEstimate: number | null; // 0..1
  sources: AISource[];
  createdAt: string;
}

export interface UserProfile {
  id: string;
  email: string | null;
  displayName: string | null;
  interests: Category[];
  experience: ExperienceLevel;
  onboarded: boolean;
  plan: PlanTier;
}

export interface Alert {
  id: string;
  marketId: string;
  kind: AlertKind;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface SubscriptionPlan {
  tier: PlanTier;
  name: string;
  priceLabel: string;
  features: string[];
}

// Data-source abstraction so Kalshi can be added without touching UI.
export interface MarketDataSource {
  readonly platform: Platform | 'mock';
  listMarkets(params?: { category?: Category; query?: string }): Promise<Market[]>;
  getMarket(id: string): Promise<Market | null>;
  getHistory(id: string): Promise<MarketHistory>;
}
