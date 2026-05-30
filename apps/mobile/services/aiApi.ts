import { api } from './api';
import * as FileSystem from 'expo-file-system';

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

export interface BarcodeLookupProduct {
  barcode: string;
  name: string;
  brand: string;
  category: string;
}

export interface BarcodeLookupResponse {
  found: boolean;
  barcode: string;
  product: BarcodeLookupProduct | null;
  fallbackOnly: boolean;
}

export interface ConditionAssessmentResult {
  condition: 'excellent' | 'good' | 'fair' | 'poor';
  confidence: number;
  notes: string;
  fallbackSuggested: boolean;
  latencyMs: number;
}

export const aiApi = {
  recognizeAsset: async (imageUri: string): Promise<AssetRecognitionResult> => {
    // Read image file and convert to base64
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const response = await api.post<AssetRecognitionResult>(
      '/ai/recognize',
      {
        imageBase64: base64,
      },
      {
        timeout: 10000, // 10 second timeout
      }
    );

    return response.data;
  },
  lookupBarcode: async (barcode: string): Promise<BarcodeLookupResponse> => {
    const response = await api.post<BarcodeLookupResponse>('/ai/barcode-lookup', {
      barcode,
    });

    return response.data;
  },
  assessCondition: async (
    imageUri: string,
    itemId?: string,
  ): Promise<ConditionAssessmentResult> => {
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const response = await api.post<ConditionAssessmentResult>('/ai/condition-assessment', {
      imageBase64: base64,
      mimeType: 'image/jpeg',
      itemId,
    });

    return response.data;
  },
};
