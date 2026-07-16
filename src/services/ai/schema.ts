import { z } from 'zod';

// Structured output contract for the Claude analysis pipeline.
export const aiAnalysisSchema = z.object({
  summary: z.string().min(1),
  bull_case: z.string().min(1),
  bear_case: z.string().min(1),
  why_changed: z.string().min(1),
  catalysts: z.array(z.string()).default([]),
  risk_factors: z.array(z.string()).default([]),
  confidence: z.enum(['low', 'medium', 'high']),
  ai_probability_estimate: z.number().min(0).max(1).nullable(),
});

export type AIAnalysisRaw = z.infer<typeof aiAnalysisSchema>;

/** Parse a Claude JSON response into a validated analysis object. */
export function parseAIAnalysis(raw: unknown): AIAnalysisRaw {
  return aiAnalysisSchema.parse(raw);
}
