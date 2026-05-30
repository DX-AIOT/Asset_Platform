import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { AssetRecognitionResult } from '../shared/vision';

type OpenAIPrediction = {
  name: string | null;
  brand: string | null;
  model: string | null;
  category: string | null;
  confidence: {
    name: number;
    brand: number;
    model: number;
    category: number;
  };
};

@Injectable()
export class VisionRecognitionService {
  private readonly openai: OpenAI | null;
  private readonly useLocalMock: boolean;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const baseURL = this.configService.get<string>('OPENAI_BASE_URL');
    const localMode = this.getBooleanConfig('OPENAI_LOCAL_MODE', !apiKey);
    this.useLocalMock = localMode || !apiKey;
    this.openai = this.useLocalMock ? null : new OpenAI({ apiKey, baseURL });
  }

  async recognizeFromBase64(imageBase64: string): Promise<AssetRecognitionResult> {
    if (!this.openai) {
      throw new Error('OPENAI_API_KEY not configured — AI features disabled in local dev');
    }
    const startedAt = Date.now();
    if (this.useLocalMock) {
      return this.mockRecognitionResult(startedAt);
    }

    const response = await this.openai!.responses.create({
      model: 'gpt-4o-mini',
      input: [
        {
          role: 'system' as const,
          content: [
            {
              type: 'input_text' as const,
              text: 'Bạn là chuyên gia phân loại tài sản gia dụng tại Việt Nam. Trả JSON với name, brand, model, category và confidence cho từng trường (0..1).',
            },
          ],
        },
        {
          role: 'user' as const,
          content: [
            {
              type: 'input_text' as const,
              text: 'Phân tích ảnh tài sản và trả JSON theo schema yêu cầu.',
            },
            {
              type: 'input_image' as const,
              image_url: `data:image/jpeg;base64,${imageBase64}`,
              detail: 'auto' as const,
            },
          ],
        },
      ] as any,
      text: {
        format: {
          type: 'json_schema',
          name: 'asset_vision_result',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              name: { type: ['string', 'null'] },
              brand: { type: ['string', 'null'] },
              model: { type: ['string', 'null'] },
              category: { type: ['string', 'null'] },
              confidence: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  name: { type: 'number', minimum: 0, maximum: 1 },
                  brand: { type: 'number', minimum: 0, maximum: 1 },
                  model: { type: 'number', minimum: 0, maximum: 1 },
                  category: { type: 'number', minimum: 0, maximum: 1 },
                },
                required: ['name', 'brand', 'model', 'category'],
              },
            },
            required: ['name', 'brand', 'model', 'category', 'confidence'],
          },
        },
      },
      max_output_tokens: 300,
    });

    const raw = response.output_text;
    const parsed = JSON.parse(raw) as OpenAIPrediction;

    const fallbackSuggested =
      !parsed.name ||
      !parsed.model ||
      parsed.confidence.name < 0.7 ||
      parsed.confidence.model < 0.65;

    return {
      name: { value: parsed.name, confidence: parsed.confidence.name },
      brand: { value: parsed.brand, confidence: parsed.confidence.brand },
      model: { value: parsed.model, confidence: parsed.confidence.model },
      category: { value: parsed.category, confidence: parsed.confidence.category },
      fallbackSuggested,
      latencyMs: Date.now() - startedAt,
    };
  }

  private mockRecognitionResult(startedAt: number): AssetRecognitionResult {
    return {
      name: { value: null, confidence: 0 },
      brand: { value: null, confidence: 0 },
      model: { value: null, confidence: 0 },
      category: { value: 'other', confidence: 0.4 },
      fallbackSuggested: true,
      latencyMs: Date.now() - startedAt,
    };
  }

  private getBooleanConfig(key: string, fallback: boolean): boolean {
    const raw = this.configService.get<string>(key);
    if (raw == null || raw.trim() === '') {
      return fallback;
    }

    return ['true', '1', 'yes', 'on'].includes(raw.trim().toLowerCase());
  }
}
