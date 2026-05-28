import { BarcodeLookupService } from './barcode-lookup.service';

describe('BarcodeLookupService', () => {
  let service: BarcodeLookupService;

  beforeEach(() => {
    service = new BarcodeLookupService();
  });

  it('returns product data when barcode exists', () => {
    const result = service.lookupByBarcode('8886467040520');

    expect(result.found).toBe(true);
    expect(result.fallbackOnly).toBe(false);
    expect(result.product?.name).toBe('Razer DeathAdder Essential');
  });

  it('returns fallback response when barcode does not exist', () => {
    const result = service.lookupByBarcode('0000000000000');

    expect(result.found).toBe(false);
    expect(result.fallbackOnly).toBe(true);
    expect(result.product).toBeNull();
    expect(result.barcode).toBe('0000000000000');
  });

  it('normalizes whitespace around barcode input', () => {
    const result = service.lookupByBarcode(' 4902777010761 ');

    expect(result.found).toBe(true);
    expect(result.product?.brand).toBe('Mitsubishi Pencil');
    expect(result.barcode).toBe('4902777010761');
  });
});
