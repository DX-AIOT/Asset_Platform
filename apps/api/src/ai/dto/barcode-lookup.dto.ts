export interface BarcodeLookupRequestDto {
  barcode: string;
}

export interface BarcodeLookupProductDto {
  barcode: string;
  name: string;
  brand: string;
  category: string;
}

export interface BarcodeLookupResponseDto {
  found: boolean;
  barcode: string;
  product: BarcodeLookupProductDto | null;
  fallbackOnly: boolean;
}
