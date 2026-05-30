import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { ValuationResult } from '@dx-aiot/shared';

/** 24h TTL per acceptance criteria. */
export const VALUATION_CACHE_TTL_SECONDS = 24 * 60 * 60;

const KEY_PREFIX = 'valuation:';

/**
 * Caches valuation results for 24h. Uses Redis when REDIS_URL is configured,
 * otherwise degrades gracefully to a process-local TTL map (mirrors the
 * local-mock pattern in VisionRecognitionService). Redis failures never break
 * a valuation request — they fall through to a cache miss.
 *
 * Lookups and writes are O(1) average. In-memory mode is O(n) space for n
 * distinct cached keys, pruned lazily on access.
 */
@Injectable()
export class ValuationCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(ValuationCacheService.name);
  private readonly redis: Redis | null;
  private readonly memory = new Map<string, { value: ValuationResult; expiresAt: number }>();

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('REDIS_URL');
    const disabled = this.isTruthy(this.configService.get<string>('VALUATION_CACHE_DISABLED'));

    if (!url || disabled) {
      this.redis = null;
      return;
    }

    try {
      this.redis = new Redis(url, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      });
      // Avoid unhandled error events crashing the process if Redis is down.
      this.redis.on('error', (err) => {
        this.logger.warn(`Redis error, falling back to in-memory cache: ${err.message}`);
      });
      void this.redis.connect().catch((err) => {
        this.logger.warn(`Redis connect failed, using in-memory cache: ${err.message}`);
      });
    } catch (err) {
      this.logger.warn(`Redis init failed, using in-memory cache: ${(err as Error).message}`);
      this.redis = null;
    }
  }

  async get(key: string, now = Date.now()): Promise<ValuationResult | null> {
    const fullKey = KEY_PREFIX + key;

    if (this.redis && this.redis.status === 'ready') {
      try {
        const raw = await this.redis.get(fullKey);
        return raw ? (JSON.parse(raw) as ValuationResult) : null;
      } catch (err) {
        this.logger.warn(`Redis get failed: ${(err as Error).message}`);
      }
    }

    const entry = this.memory.get(fullKey);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt <= now) {
      this.memory.delete(fullKey);
      return null;
    }
    return entry.value;
  }

  async set(
    key: string,
    value: ValuationResult,
    ttlSeconds = VALUATION_CACHE_TTL_SECONDS,
    now = Date.now(),
  ): Promise<void> {
    const fullKey = KEY_PREFIX + key;

    if (this.redis && this.redis.status === 'ready') {
      try {
        await this.redis.set(fullKey, JSON.stringify(value), 'EX', ttlSeconds);
        return;
      } catch (err) {
        this.logger.warn(`Redis set failed: ${(err as Error).message}`);
      }
    }

    this.memory.set(fullKey, { value, expiresAt: now + ttlSeconds * 1000 });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit().catch(() => undefined);
    }
  }

  private isTruthy(raw: string | undefined): boolean {
    return !!raw && ['true', '1', 'yes', 'on'].includes(raw.trim().toLowerCase());
  }
}
