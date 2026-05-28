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
