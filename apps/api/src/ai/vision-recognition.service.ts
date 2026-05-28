import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { AssetRecognitionResult } from '@dx-aiot/shared';

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
  private readonly openai: OpenAI;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.openai = new OpenAI({ apiKey });
  }

  async recognizeFromBase64(imageBase64: string): Promise<AssetRecognitionResult> {
    const startedAt = Date.now();

    const response = await this.openai.responses.create({
      model: 'gpt-4o-mini',
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: 'Bạn là chuyên gia phân loại tài sản gia dụng tại Việt Nam. Trả JSON với name, brand, model, category và confidence cho từng trường (0..1).',
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: 'Phân tích ảnh tài sản và trả JSON theo schema yêu cầu.',
            },
            {
              type: 'input_image',
              image_url: `data:image/jpeg;base64,${imageBase64}`,
            },
          ],
        },
      ],
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
      !parsed.name || !parsed.model || parsed.confidence.name < 0.7 || parsed.confidence.model < 0.65;

    return {
      name: { value: parsed.name, confidence: parsed.confidence.name },
      brand: { value: parsed.brand, confidence: parsed.confidence.brand },
      model: { value: parsed.model, confidence: parsed.confidence.model },
      category: { value: parsed.category, confidence: parsed.confidence.category },
      fallbackSuggested,
      latencyMs: Date.now() - startedAt,
    };
  }
}
