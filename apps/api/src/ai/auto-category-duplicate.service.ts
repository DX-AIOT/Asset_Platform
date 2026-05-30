import { Injectable } from '@nestjs/common';
import { AssetFingerprintDto, InventoryAssetDto } from './dto/auto-category-duplicate.dto';

export type CanonicalCategory =
  | 'smartphone'
  | 'laptop'
  | 'tablet'
  | 'tv'
  | 'refrigerator'
  | 'washing_machine'
  | 'air_conditioner'
  | 'motorbike'
  | 'camera'
  | 'other';

export type DuplicateCandidate = {
  itemId: string;
  score: number;
  reason: string;
};

export type AutoCategoryDuplicateResult = {
  autoCategory: {
    category: CanonicalCategory;
    confidence: number;
  };
  duplicateDetection: {
    isDuplicateLikely: boolean;
    matches: DuplicateCandidate[];
  };
};

@Injectable()
export class AutoCategoryDuplicateService {
  private readonly categoryRules: Array<{ category: CanonicalCategory; keywords: string[] }> = [
    { category: 'smartphone', keywords: ['phone', 'iphone', 'android', 'smartphone', 'galaxy'] },
    { category: 'laptop', keywords: ['laptop', 'notebook', 'macbook', 'thinkpad'] },
    { category: 'tablet', keywords: ['tablet', 'ipad'] },
    { category: 'tv', keywords: ['tv', 'television', 'oled', 'qled', 'smart tv'] },
    { category: 'refrigerator', keywords: ['fridge', 'refrigerator', 'tủ lạnh'] },
    { category: 'washing_machine', keywords: ['washing machine', 'washer', 'máy giặt'] },
    { category: 'air_conditioner', keywords: ['air conditioner', 'ac', 'điều hòa'] },
    { category: 'motorbike', keywords: ['motorbike', 'xe máy', 'scooter'] },
    { category: 'camera', keywords: ['camera', 'dslr', 'mirrorless', 'gopro'] },
  ];

  // Category scoring is O(C*K + T), duplicate scoring is O(N*L), space O(N+T):
  // C categories, K keywords/category, T tokens for candidate, N inventory size, L combined token length/item.
  evaluate(
    candidate: AssetFingerprintDto,
    inventory: InventoryAssetDto[]
  ): AutoCategoryDuplicateResult {
    const autoCategory = this.predictCategory(candidate);
    const matches = inventory
      .map((item) => this.scoreDuplicate(candidate, item))
      .filter((row) => row.score >= 0.7)
      .sort((a, b) => b.score - a.score);

    return {
      autoCategory,
      duplicateDetection: {
        isDuplicateLikely: matches.some((row) => row.score >= 0.82),
        matches,
      },
    };
  }

  private predictCategory(candidate: AssetFingerprintDto): {
    category: CanonicalCategory;
    confidence: number;
  } {
    const source = [candidate.name, candidate.brand, candidate.model, candidate.categoryHint]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    let bestCategory: CanonicalCategory = 'other';
    let bestScore = 0;

    for (const rule of this.categoryRules) {
      let score = 0;
      for (const keyword of rule.keywords) {
        if (source.includes(keyword)) {
          score += keyword.includes(' ') ? 1.2 : 1;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestCategory = rule.category;
      }
    }

    if (bestCategory === 'other') {
      return { category: 'other', confidence: 0.5 };
    }

    const confidence = Math.min(0.98, 0.62 + bestScore * 0.12);
    return { category: bestCategory, confidence };
  }

  private scoreDuplicate(
    candidate: AssetFingerprintDto,
    item: InventoryAssetDto
  ): DuplicateCandidate {
    const nameSimilarity = this.jaccard(this.tokenize(candidate.name), this.tokenize(item.name));
    const brandBoost = this.sameNormalized(candidate.brand, item.brand) ? 0.14 : 0;
    const modelBoost = this.sameNormalized(candidate.model, item.model) ? 0.22 : 0;
    const categoryBoost = this.sameNormalized(candidate.categoryHint, item.categoryHint) ? 0.08 : 0;
    const score = Math.min(1, nameSimilarity * 0.68 + brandBoost + modelBoost + categoryBoost);

    const reasonParts: string[] = [];
    if (nameSimilarity >= 0.5) {
      reasonParts.push(`name_sim=${nameSimilarity.toFixed(2)}`);
    }
    if (brandBoost > 0) {
      reasonParts.push('same_brand');
    }
    if (modelBoost > 0) {
      reasonParts.push('same_model');
    }
    if (categoryBoost > 0) {
      reasonParts.push('same_category_hint');
    }

    return {
      itemId: item.id,
      score,
      reason: reasonParts.join(', ') || 'low_overlap',
    };
  }

  private tokenize(input: string | undefined): Set<string> {
    if (!input) {
      return new Set();
    }
    const normalized = input
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return new Set(normalized.split(' ').filter((token) => token.length > 1));
  }

  private jaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) {
      return 0;
    }

    let intersection = 0;
    for (const token of a) {
      if (b.has(token)) {
        intersection += 1;
      }
    }

    const union = a.size + b.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }

  private sameNormalized(left?: string, right?: string): boolean {
    if (!left || !right) {
      return false;
    }
    return left.trim().toLowerCase() === right.trim().toLowerCase();
  }
}
