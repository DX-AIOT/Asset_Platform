import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OcrReceiptDto } from './dto/ocr-receipt.dto';

export type ReceiptOcrResult = {
  purchaseDate: string | null;
  totalAmount: number | null;
  currency: string | null;
  warrantyExpiryDate: string | null;
  confidence: number;
};

type RawModelResult = {
  purchaseDate?: string | null;
  totalAmount?: string | number | null;
  currency?: string | null;
  warrantyExpiryDate?: string | null;
  warrantyPeriodMonths?: string | number | null;
  confidence?: number | null;
};

@Injectable()
export class OcrReceiptService {
  constructor(private readonly configService: ConfigService) {}

  async extract(payload: OcrReceiptDto): Promise<ReceiptOcrResult> {
    if (!payload.imageUrl && !payload.imageBase64) {
      throw new BadRequestException('imageUrl or imageBase64 is required');
    }

    const modelResult = await this.callVisionModel(payload);
    return this.normalize(modelResult);
  }

  private async callVisionModel(payload: OcrReceiptDto): Promise<RawModelResult> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const localMode = this.getBooleanConfig('OPENAI_LOCAL_MODE', !apiKey);
    if (localMode || !apiKey) {
      return this.mockModelResult();
    }

    const model = this.configService.get<string>('OPENAI_OCR_MODEL') ?? 'gpt-4.1-mini';
    const openAIBaseUrl =
      this.configService.get<string>('OPENAI_BASE_URL')?.replace(/\/$/, '') ?? 'https://api.openai.com/v1';
    const imageInput = payload.imageUrl
      ? { type: 'input_image', image_url: payload.imageUrl }
      : {
          type: 'input_image',
          image_url: `data:${payload.mimeType ?? 'image/jpeg'};base64,${payload.imageBase64}`,
        };

    const response = await fetch(`${openAIBaseUrl}/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: 'Extract receipt/invoice fields. Return JSON only with keys: purchaseDate, totalAmount, currency, warrantyExpiryDate, warrantyPeriodMonths, confidence. Accept Vietnamese and English receipts. purchaseDate and warrantyExpiryDate should keep source format if uncertain.',
              },
              imageInput,
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new InternalServerErrorException(`OpenAI OCR request failed: ${errorBody}`);
    }

    const json = (await response.json()) as { output_text?: string };
    if (!json.output_text) {
      throw new InternalServerErrorException('OpenAI OCR response did not contain output_text');
    }

    try {
      return JSON.parse(json.output_text) as RawModelResult;
    } catch {
      throw new InternalServerErrorException('OpenAI OCR response was not valid JSON');
    }
  }

  private mockModelResult(): RawModelResult {
    return {
      purchaseDate: null,
      totalAmount: null,
      currency: null,
      warrantyExpiryDate: null,
      warrantyPeriodMonths: null,
      confidence: 0,
    };
  }

  // O(n) time and O(1) space over each small field string; keeps endpoint latency dominated by model call.
  normalize(raw: RawModelResult): ReceiptOcrResult {
    const purchaseDate = this.normalizeDate(raw.purchaseDate ?? null);
    const explicitWarrantyDate = this.normalizeDate(raw.warrantyExpiryDate ?? null);
    const warrantyMonths = this.normalizeAmount(raw.warrantyPeriodMonths ?? null);
    const warrantyExpiryDate =
      explicitWarrantyDate ??
      (purchaseDate && warrantyMonths
        ? this.addMonths(purchaseDate, Math.floor(warrantyMonths))
        : null);

    return {
      purchaseDate,
      totalAmount: this.normalizeAmount(raw.totalAmount ?? null),
      currency: this.normalizeCurrency(raw.currency ?? null),
      warrantyExpiryDate,
      confidence: this.normalizeConfidence(raw.confidence),
    };
  }

  private normalizeConfidence(value: number | null | undefined): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return 0;
    }
    return Math.max(0, Math.min(1, value));
  }

  private normalizeCurrency(value: string | null): string | null {
    if (!value) {
      return null;
    }

    const lowered = value.trim().toLowerCase();
    if (['đ', 'vnđ', 'vnd', 'dong'].includes(lowered)) {
      return 'VND';
    }
    if (['$', 'usd', 'us dollar'].includes(lowered)) {
      return 'USD';
    }

    return value.trim().toUpperCase();
  }

  private normalizeAmount(value: string | number | null): number | null {
    if (value == null) {
      return null;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    const stripped = value.replace(/[^\d,.-]/g, '').trim();
    if (!stripped) {
      return null;
    }

    const hasComma = stripped.includes(',');
    const hasDot = stripped.includes('.');

    let normalized = stripped;
    if (hasComma && hasDot) {
      // Heuristic: dot as thousand separator, comma as decimal separator for formats like 1.234,56
      if (stripped.lastIndexOf(',') > stripped.lastIndexOf('.')) {
        normalized = stripped.replace(/\./g, '').replace(',', '.');
      } else {
        normalized = stripped.replace(/,/g, '');
      }
    } else if (hasComma) {
      const groups = stripped.split(',');
      normalized = groups[groups.length - 1].length === 3 ? stripped.replace(/,/g, '') : stripped.replace(',', '.');
    } else if (hasDot) {
      const groups = stripped.split('.');
      const allThousandsGroups = groups.length > 1 && groups.slice(1).every((group) => group.length === 3);
      normalized = allThousandsGroups ? stripped.replace(/\./g, '') : stripped;
    } else {
      normalized = stripped;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private normalizeDate(input: string | null): string | null {
    if (!input) {
      return null;
    }

    const value = input.trim();

    const dmyMatch = value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
    if (dmyMatch) {
      const day = Number(dmyMatch[1]);
      const month = Number(dmyMatch[2]);
      const year = this.expandYear(Number(dmyMatch[3]));
      return this.toIsoDate(year, month, day);
    }

    const ymdMatch = value.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
    if (ymdMatch) {
      return this.toIsoDate(Number(ymdMatch[1]), Number(ymdMatch[2]), Number(ymdMatch[3]));
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }

    return null;
  }

  private addMonths(isoDate: string, months: number): string | null {
    if (months <= 0) {
      return null;
    }

    const base = new Date(`${isoDate}T00:00:00.000Z`);
    if (Number.isNaN(base.getTime())) {
      return null;
    }

    const next = new Date(base);
    next.setUTCMonth(next.getUTCMonth() + months);
    return next.toISOString().slice(0, 10);
  }

  private expandYear(year: number): number {
    return year < 100 ? 2000 + year : year;
  }

  private toIsoDate(year: number, month: number, day: number): string | null {
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() + 1 !== month ||
      date.getUTCDate() !== day
    ) {
      return null;
    }

    return date.toISOString().slice(0, 10);
  }

  private getBooleanConfig(key: string, fallback: boolean): boolean {
    const raw = this.configService.get<string>(key);
    if (raw == null || raw.trim() === '') {
      return fallback;
    }

    return ['true', '1', 'yes', 'on'].includes(raw.trim().toLowerCase());
  }
}
