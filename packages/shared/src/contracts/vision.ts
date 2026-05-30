export interface FieldConfidence {
  value: string | null;
  confidence: number;
}

export interface AssetRecognitionResult {
  name: FieldConfidence;
  brand: FieldConfidence;
  model: FieldConfidence;
  category: FieldConfidence;
  fallbackSuggested: boolean;
  latencyMs: number;
}

/**
 * Physical condition grade assessed from an asset photo.
 * Ordered best → worst. Distinct from the storage-side ItemCondition enum
 * (which also has `new`/`like_new`); `excellent` maps to `like_new` on persist.
 */
export type AssetConditionGrade = 'excellent' | 'good' | 'fair' | 'poor';

export interface ConditionAssessmentResult {
  condition: AssetConditionGrade;
  /** Model confidence in the assigned grade, clamped to 0..1. */
  confidence: number;
  /** Short human-readable reasoning: visible wear, scratches, damage, cleanliness. */
  notes: string;
  /** True when the model was unavailable/low-confidence and a neutral default was used. */
  fallbackSuggested: boolean;
  latencyMs: number;
}
