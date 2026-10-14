import Redis from 'ioredis';
import { config } from './index';
import { logger } from '../utils/logger';

let redis: Redis | null = null;
let redisAvailable = false;
let redisErrorLogged = false;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        if (times > 3) {
          if (!redisErrorLogged) {
            logger.warn('Redis unavailable — caching disabled. App continues without cache.');
            redisErrorLogged = true;
          }
          return null as unknown as number;
        }
        return Math.min(times * 50, 2000);
      },
      lazyConnect: true,
    });

    redis.on('error', () => {
      if (!redisErrorLogged) {
        logger.warn('Redis unavailable — caching disabled. App continues without cache.');
        redisErrorLogged = true;
      }
    });
  }
  return redis;
}

export async function connectRedis(): Promise<void> {
  try {
    const r = getRedis();
    await r.connect();
    logger.info('Redis connected');
  } catch (err) {
    logger.warn('Redis connection failed, caching disabled:', (err as Error).message);
  }
}

export async function getCached(key: string): Promise<string | null> {
  try {
    const r = getRedis();
    if (r.status === 'ready') {
      return await r.get(key);
    }
  } catch {
    // Cache miss on error
  }
  return null;
}

export async function setCache(key: string, value: string, ttl: number = config.cacheTtl): Promise<void> {
  try {
    const r = getRedis();
    if (r.status === 'ready') {
      await r.setex(key, ttl, value);
    }
  } catch {
    // Silently fail cache writes
  }
}

export async function invalidateCache(pattern: string = 'stock:*'): Promise<void> {
  try {
    const r = getRedis();
    if (r.status === 'ready') {
      const keys = await r.keys(pattern);
      if (keys.length > 0) {
        await r.del(...keys);
      }
    }
  } catch {
    // Silently fail cache invalidation
  }
}
