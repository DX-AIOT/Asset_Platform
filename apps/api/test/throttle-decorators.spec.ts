/**
 * Verify @Throttle decorator metadata is applied to the expected routes.
 * Inspects Reflect metadata directly — no NestJS DI bootstrapping needed.
 *
 * @nestjs/throttler v6 stores per-throttler metadata under the keys:
 *   THROTTLER:LIMIT{name}  — request limit
 *   THROTTLER:TTL{name}    — time window in ms
 */
import 'reflect-metadata';
import { AuthController } from '../src/auth/auth.controller';
import { AiController } from '../src/ai/ai.controller';
import { AssetIntelligenceController } from '../src/ai/asset-intelligence.controller';
import { OcrReceiptController } from '../src/ai/ocr-receipt.controller';
import { TransactionsController } from '../src/transactions/transactions.controller';

const THROTTLER_NAME = 'default';

function getLimit(
  // eslint-disable-next-line @typescript-eslint/ban-types
  target: Function,
  methodName: string,
): number | undefined {
  return Reflect.getMetadata(`THROTTLER:LIMIT${THROTTLER_NAME}`, target.prototype[methodName]);
}

function getTtl(
  // eslint-disable-next-line @typescript-eslint/ban-types
  target: Function,
  methodName: string,
): number | undefined {
  return Reflect.getMetadata(`THROTTLER:TTL${THROTTLER_NAME}`, target.prototype[methodName]);
}

describe('@Throttle decorator coverage', () => {
  describe('AuthController', () => {
    it('login throttled at 10/min', () => {
      expect(getLimit(AuthController, 'login')).toBe(10);
      expect(getTtl(AuthController, 'login')).toBe(60_000);
    });

    it('register throttled at 10/min', () => {
      expect(getLimit(AuthController, 'register')).toBe(10);
      expect(getTtl(AuthController, 'register')).toBe(60_000);
    });
  });

  describe('AiController', () => {
    const cases: [string, number][] = [
      ['recognize', 20],
      ['lookupBarcode', 20],
      ['valuation', 20],
      ['conditionAssessment', 20],
      ['listingPriceSuggest', 20],
      ['listingAutofill', 20],
    ];

    for (const [method, expectedLimit] of cases) {
      it(`${method} throttled at ${expectedLimit}/min`, () => {
        expect(getLimit(AiController, method)).toBe(expectedLimit);
        expect(getTtl(AiController, method)).toBe(60_000);
      });
    }
  });

  describe('AssetIntelligenceController', () => {
    it('classifyAndDetect throttled at 20/min', () => {
      expect(getLimit(AssetIntelligenceController, 'classifyAndDetect')).toBe(20);
      expect(getTtl(AssetIntelligenceController, 'classifyAndDetect')).toBe(60_000);
    });
  });

  describe('OcrReceiptController', () => {
    it('ocrReceipt throttled at 20/min', () => {
      expect(getLimit(OcrReceiptController, 'ocrReceipt')).toBe(20);
      expect(getTtl(OcrReceiptController, 'ocrReceipt')).toBe(60_000);
    });
  });

  describe('TransactionsController (payments)', () => {
    const cases: [string, number][] = [
      ['initiate', 30],
      ['confirmReceipt', 30],
      ['raiseDispute', 30],
    ];

    for (const [method, expectedLimit] of cases) {
      it(`${method} throttled at ${expectedLimit}/min`, () => {
        expect(getLimit(TransactionsController, method)).toBe(expectedLimit);
        expect(getTtl(TransactionsController, method)).toBe(60_000);
      });
    }
  });
});
