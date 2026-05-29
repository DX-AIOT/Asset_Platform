import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  PriceHistoryPoint,
  PriceHistoryResponse,
  PriceHistorySource,
  TrendDirection,
  TrendWindow,
  TrendWindowDays,
} from '@dx-aiot/shared';

export class PriceHistoryPointDto implements PriceHistoryPoint {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 980.0 })
  estimatedValue!: number;

  @ApiProperty({ example: 'USD' })
  currency!: string;

  @ApiProperty({ enum: ['manual', 'ai', 'market'], example: 'ai' })
  source!: PriceHistorySource;

  @ApiProperty({ example: '2026-05-29T00:00:00.000Z' })
  recordedAt!: string;
}

export class TrendWindowDto implements TrendWindow {
  @ApiProperty({ enum: [30, 90, 365], example: 30 })
  windowDays!: TrendWindowDays;

  @ApiProperty({ enum: ['up', 'flat', 'down'], example: 'down' })
  direction!: TrendDirection;

  @ApiPropertyOptional({ type: Number, example: -12.5, description: 'Signed % change over the window; null when no history.' })
  percentChange!: number | null;

  @ApiPropertyOptional({ type: Number, example: 1120.0, description: 'Baseline value at window start; null when no history.' })
  fromValue!: number | null;

  @ApiPropertyOptional({ type: Number, example: 980.0, description: 'Latest value; null when no history.' })
  toValue!: number | null;
}

export class PriceHistoryResponseDto implements PriceHistoryResponse {
  @ApiProperty({ format: 'uuid' })
  itemId!: string;

  @ApiProperty({ example: 'USD' })
  currency!: string;

  @ApiProperty({ type: [PriceHistoryPointDto], description: 'Time-series ordered oldest → newest.' })
  points!: PriceHistoryPointDto[];

  @ApiPropertyOptional({ type: Number, example: 980.0, description: 'Most recent estimated value; null when no history.' })
  latestValue!: number | null;

  @ApiProperty({ type: [TrendWindowDto], description: 'Trend over 30/90/365-day trailing windows.' })
  trends!: TrendWindowDto[];
}
