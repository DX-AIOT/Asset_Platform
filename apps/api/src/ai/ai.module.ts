import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OcrReceiptController } from './ocr-receipt.controller';
import { OcrReceiptService } from './ocr-receipt.service';
import { AiController } from './ai.controller';
import { VisionRecognitionService } from './vision-recognition.service';
import { AssetIntelligenceController } from './asset-intelligence.controller';
import { AutoCategoryDuplicateService } from './auto-category-duplicate.service';
import { BarcodeLookupService } from './barcode-lookup.service';
import { MarketValuationService } from './market-valuation.service';
import { ValuationCacheService } from './valuation-cache.service';
import { ConditionAssessmentService } from './condition-assessment.service';
import { PriceHistoryService } from './price-history.service';
import { ValuationRefreshService } from './valuation-refresh.service';
import { MarketTrendsService } from './market-trends.service';
import { MarketTrendsController } from './market-trends.controller';
import { ListingSuggestionService } from './listing-suggestion.service';
import { ListingSuggestionCacheService } from './listing-suggestion-cache.service';
import { Item } from '../items/entities/item.entity';
import { PriceHistory } from '../items/entities/price-history.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Item, PriceHistory])],
  controllers: [
    AiController,
    OcrReceiptController,
    AssetIntelligenceController,
    MarketTrendsController,
  ],
  providers: [
    VisionRecognitionService,
    OcrReceiptService,
    AutoCategoryDuplicateService,
    BarcodeLookupService,
    MarketValuationService,
    ValuationCacheService,
    ConditionAssessmentService,
    PriceHistoryService,
    ValuationRefreshService,
    MarketTrendsService,
    ListingSuggestionService,
    ListingSuggestionCacheService,
  ],
  exports: [ConditionAssessmentService, PriceHistoryService, MarketTrendsService],
})
export class AiModule {}
