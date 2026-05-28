import { BadRequestException } from '@nestjs/common';
import { AiController } from './ai.controller';
import { BarcodeLookupService } from './barcode-lookup.service';

describe('AiController', () => {
  let controller: AiController;

  beforeEach(() => {
    controller = new AiController(new BarcodeLookupService());
  });

  it('throws BadRequestException when barcode is missing', () => {
    expect(() => controller.lookupBarcode({ barcode: '' })).toThrow(
      BadRequestException
    );
  });

  it('returns lookup response for valid barcode payload', () => {
    const result = controller.lookupBarcode({ barcode: '8806090488799' });

    expect(result.found).toBe(true);
    expect(result.product?.brand).toBe('Samsung');
  });
});
