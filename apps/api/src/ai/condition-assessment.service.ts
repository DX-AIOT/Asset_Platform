import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import OpenAI from 'openai';
import {
  AssetConditionGrade,
  ConditionAssessmentResult,
} from '@dx-aiot/shared';
import { ConditionAssessmentDto } from './dto/condition-assessment.dto';
import { Item, ItemCondition } from '../items/entities/item.entity';
import { PriceHistorySource } from '../items/entities/price-history.entity';
import { PriceHistoryService } from './price-history.service';

const CONDITION_GRADES: AssetConditionGrade[] = ['excellent', 'good', 'fair', 'poor'];

/**
 * Maps the AI grade (excellent/good/fair/poor) to the storage-side
 * ItemCondition enum. `excellent` has no direct enum member, so it maps
 * to the closest stored value, `like_new`.
 */
const GRADE_TO_ITEM_CONDITION: Record<AssetConditionGrade, ItemCondition> = {
  excellent: ItemCondition.LIKE_NEW,
  good: ItemCondition.GOOD,
  fair: ItemCondition.FAIR,
  poor: ItemCondition.POOR,
};

type RawConditionResult = {
  condition?: string | null;
  confidence?: number | null;
  notes?: string | null;
};

const SYSTEM_PROMPT =
  'You are an asset condition appraiser. Inspect the photo of a physical item and grade ' +
  'its overall condition strictly into one of: "excellent", "good", "fair", "poor". ' +
  'Base the grade on visible wear, scratches, dents, cracks, damage, missing parts, and cleanliness. ' +
  'Definitions: "excellent" = looks like new, no visible wear; "good" = light wear, minor blemishes, ' +
  'fully functional; "fair" = noticeable scratches/wear or cosmetic damage but intact; ' +
  '"poor" = heavy damage, cracks, missing parts, or severe wear. ' +
  'Return concise notes (max ~200 chars) citing the specific visual evidence behind the grade, and a ' +
  'confidence between 0 and 1.';

@Injectable()
export class ConditionAssessmentService {
  private readonly openai: OpenAI | null;
  private readonly useLocalMock: boolean;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Item)
    private readonly itemsRepository: Repository<Item>,
    private readonly priceHistoryService: PriceHistoryService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const baseURL = this.configService.get<string>('OPENAI_BASE_URL');
    const localMode = this.getBooleanConfig('OPENAI_LOCAL_MODE', !apiKey);
    this.useLocalMock = localMode || !apiKey;
    this.openai = this.useLocalMock ? null : new OpenAI({ apiKey, baseURL });
  }

  async assess(payload: ConditionAssessmentDto): Promise<ConditionAssessmentResult> {
    if (!payload.photoUrl && !payload.imageBase64) {
      throw new BadRequestException('photoUrl or imageBase64 is required');
    }

    const startedAt = Date.now();
    const result = this.useLocalMock
      ? this.mockResult(startedAt)
      : this.normalize(await this.callVisionModel(payload), startedAt);

    if (payload.itemId) {
      await this.persistCondition(payload.itemId, result.condition);
    }

    return result;
  }

  private async callVisionModel(payload: ConditionAssessmentDto): Promise<RawConditionResult> {
    const model = this.configService.get<string>('OPENAI_VISION_MODEL') ?? 'gpt-4o-mini';
    const imageUrl = payload.photoUrl
      ? payload.photoUrl
      : `data:${payload.mimeType ?? 'image/jpeg'};base64,${payload.imageBase64}`;

    const response = await this.openai!.responses.create({
      model,
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: SYSTEM_PROMPT }],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: 'Assess the physical condition of the item in this photo and return JSON per the schema.',
            },
            { type: 'input_image', image_url: imageUrl },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'condition_assessment',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              condition: { type: 'string', enum: CONDITION_GRADES },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
              notes: { type: 'string' },
            },
            required: ['condition', 'confidence', 'notes'],
          },
        },
      },
      max_output_tokens: 300,
    });

    return JSON.parse(response.output_text) as RawConditionResult;
  }

  /**
   * Normalizes a raw model payload into a validated result.
   * O(1) over a fixed set of small fields. Falls back to a neutral "fair"
   * grade (with fallbackSuggested=true) when the model returns an unknown
   * or missing grade, so the endpoint never throws on malformed model output.
   */
  normalize(raw: RawConditionResult, startedAt: number): ConditionAssessmentResult {
    const grade = this.normalizeGrade(raw.condition);
    const fallbackSuggested = grade == null;

    return {
      condition: grade ?? 'fair',
      confidence: fallbackSuggested ? 0 : this.normalizeConfidence(raw.confidence),
      notes: this.normalizeNotes(raw.notes),
      fallbackSuggested,
      latencyMs: Date.now() - startedAt,
    };
  }

  private normalizeGrade(value: string | null | undefined): AssetConditionGrade | null {
    if (typeof value !== 'string') {
      return null;
    }
    const lowered = value.trim().toLowerCase();
    return (CONDITION_GRADES as string[]).includes(lowered)
      ? (lowered as AssetConditionGrade)
      : null;
  }

  private normalizeConfidence(value: number | null | undefined): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return 0;
    }
    return Math.max(0, Math.min(1, value));
  }

  private normalizeNotes(value: string | null | undefined): string {
    if (typeof value !== 'string') {
      return '';
    }
    return value.trim();
  }

  /** Translate the AI grade to the persisted enum value. */
  static toItemCondition(grade: AssetConditionGrade): ItemCondition {
    return GRADE_TO_ITEM_CONDITION[grade];
  }

  private async persistCondition(itemId: string, grade: AssetConditionGrade): Promise<void> {
    const item = await this.itemsRepository.findOne({ where: { id: itemId } });
    if (!item) {
      // Assessment still returned to the caller; nothing to persist.
      return;
    }
    const nextCondition = ConditionAssessmentService.toItemCondition(grade);
    const changed = item.condition !== nextCondition;
    item.condition = nextCondition;
    await this.itemsRepository.save(item);

    // Record a fresh value snapshot when the condition actually changes, so the
    // price history reflects the re-graded asset. recordSnapshot is best-effort
    // and never throws, so it cannot break the assessment response.
    if (changed) {
      await this.priceHistoryService.recordSnapshot(item, PriceHistorySource.AI);
    }
  }

  private mockResult(startedAt: number): ConditionAssessmentResult {
    return {
      condition: 'good',
      confidence: 0,
      notes: 'Local mock: vision model not configured.',
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
