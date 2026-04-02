import { Redis } from '@upstash/redis'

const PREFIX = 'sutra:'

let _redis: Redis | null = null

function getRedis(): Redis | null {
  if (_redis) return _redis

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()

  if (!url || !token) return null

  try {
    _redis = new Redis({ url, token })
    return _redis
  } catch {
    return null
  }
}

/**
 * Get cached data or fetch from source.
 * @param key - Cache key (auto-prefixed with "sutra:")
 * @param fetcher - Async function to get fresh data
 * @param ttlSeconds - Time to live in seconds (default 60)
 */
export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds = 60
): Promise<T> {
  const redis = getRedis()

  if (redis) {
    try {
      const hit = await redis.get<T>(`${PREFIX}${key}`)
      if (hit !== null && hit !== undefined) return hit
    } catch {
      // Redis down — fallback to fetcher
    }
  }

  const data = await fetcher()

  if (redis) {
    try {
      await redis.set(`${PREFIX}${key}`, JSON.stringify(data), { ex: ttlSeconds })
    } catch {
      // Redis down — still return data
    }
  }

  return data
}

/**
 * Invalidate a cache key.
 */
export async function invalidateCache(key: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return

  try {
    await redis.del(`${PREFIX}${key}`)
  } catch {
    // Ignore Redis errors on invalidation
  }
}

/**
 * Invalidate all keys matching a pattern.
 */
export async function invalidateCachePattern(pattern: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return

  try {
    const keys = await redis.keys(`${PREFIX}${pattern}`)
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  } catch {
    // Ignore Redis errors
  }
}
