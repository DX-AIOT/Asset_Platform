import { Injectable } from '@nestjs/common';
import {
  BarcodeLookupProductDto,
  BarcodeLookupResponseDto
} from './dto/barcode-lookup.dto';

@Injectable()
export class BarcodeLookupService {
  // O(1) average lookup with hash map; O(n) space for n seeded barcodes.
  private readonly seededProducts = new Map<string, BarcodeLookupProductDto>([
    [
      '8806090488799',
      {
        barcode: '8806090488799',
        name: 'Samsung Galaxy Buds FE',
        brand: 'Samsung',
        category: 'Audio Accessories'
      }
    ],
    [
      '4902777010761',
      {
        barcode: '4902777010761',
        name: 'Mitsubishi Uni-ball One Gel Pen',
        brand: 'Mitsubishi Pencil',
        category: 'Stationery'
      }
    ],
    [
      '8886467040520',
      {
        barcode: '8886467040520',
        name: 'Razer DeathAdder Essential',
        brand: 'Razer',
        category: 'Computer Peripherals'
      }
    ]
  ]);

  lookupByBarcode(rawBarcode: string): BarcodeLookupResponseDto {
    const barcode = rawBarcode.trim();
    const product = this.seededProducts.get(barcode) ?? null;

    if (product) {
      return {
        found: true,
        barcode,
        product,
        fallbackOnly: false
      };
    }

    return {
      found: false,
      barcode,
      product: null,
      fallbackOnly: true
    };
  }
}
