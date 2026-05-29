import { ApiProperty } from '@nestjs/swagger';

export class PortfolioValueResponseDto {
  @ApiProperty({ description: 'Sum of all original purchase prices.', example: 5000.0 })
  total!: number;

  @ApiProperty({ description: 'Sum of current depreciated values across all assets.', example: 3800.0 })
  depreciated!: number;
}
