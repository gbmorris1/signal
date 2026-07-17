import { z } from 'zod';

// Structured output contract for the Claude analysis pipeline.
const sourceSchema = z.object({
  title: z.string().default(''),
  url: z.string().default(''),
  date: z.string().nullable().optional(),
});

export const aiAnalysisSchema = z.object({
  edge: z.string().default(''),
  summary: z.string().min(1),
  bull_case: z.string().min(1),
  bear_case: z.string().min(1),
  why_changed: z.string().min(1),
  catalysts: z.array(z.string()).default([]),
  risk_factors: z.array(z.string()).default([]),
  confidence: z.enum(['low', 'medium', 'high']),
  ai_probability_estimate: z.number().min(0).max(1).nullable(),
  sources: z.array(sourceSchema).default([]),
});

export type AIAnalysisRaw = z.infer<typeof aiAnalysisSchema>;

/** Parse a Claude JSON response into a validated analysis object. */
export function parseAIAnalysis(raw: unknown): AIAnalysisRaw {
  return aiAnalysisSchema.parse(raw);
}
