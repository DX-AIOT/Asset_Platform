export class DepreciationYearPointDto {
  year!: number;
  date!: string;
  value!: number;
}

export class DepreciationResponseDto {
  currentValue!: number | null;
  percentLost!: number | null;
  annualRatePercent!: number;
  valueHistory!: DepreciationYearPointDto[];
}
