import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DepreciationYearPointDto {
  @ApiProperty({ example: 2022 })
  year!: number;

  @ApiProperty({ example: '2022-01-01' })
  date!: string;

  @ApiProperty({ example: 800.0 })
  value!: number;
}

export class DepreciationResponseDto {
  @ApiPropertyOptional({ type: Number, example: 640.0, description: 'Null when purchase data is missing.' })
  currentValue!: number | null;

  @ApiPropertyOptional({ type: Number, example: 20.0, description: 'Percentage of value lost since purchase. Null when purchase data is missing.' })
  percentLost!: number | null;

  @ApiProperty({ example: 20, description: 'Annual depreciation rate used (percent).' })
  annualRatePercent!: number;

  @ApiProperty({ type: [DepreciationYearPointDto], description: 'Year-by-year value history from purchase year to current year.' })
  valueHistory!: DepreciationYearPointDto[];
}
