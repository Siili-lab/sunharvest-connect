/**
 * Redis Client for SunHarvest Connect
 *
 * Used for caching price predictions, market data, and weather data.
 * Falls back gracefully to no-cache when Redis is unavailable.
 */

import { createClient, RedisClientType } from 'redis';

let client: RedisClientType | null = null;
let isConnected = false;

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Default TTLs (in seconds)
export const TTL = {
  PRICE_PREDICTION: 24 * 60 * 60,  // 24 hours
  MARKET_PRICES: 60 * 60,          // 1 hour
  MARKET_TRENDS: 30 * 60,          // 30 minutes
  WEATHER: 3 * 60 * 60,            // 3 hours
  INTELLIGENCE: 15 * 60,           // 15 minutes
};

/**
 * Connect to Redis. Safe to call multiple times — only connects once.
 */
export async function connectRedis(): Promise<void> {
  if (client && isConnected) return;

  try {
    client = createClient({
      url: REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 2) {
            console.warn('[Redis] Max retries reached — caching disabled');
            return false as any; // Stop reconnecting
          }
          return Math.min(retries * 500, 2000);
        },
        connectTimeout: 3000,
      },
    });

    client.on('error', (err) => {
      if (isConnected) {
        console.warn('[Redis] Connection error:', err.message);
      }
      isConnected = false;
    });

    client.on('connect', () => {
      console.log('[Redis] Connected');
      isConnected = true;
    });

    await client.connect();
    isConnected = true;
  } catch (err) {
    console.warn('[Redis] Failed to connect — caching disabled');
    if (client) {
      try { await client.disconnect(); } catch {}
    }
    client = null;
    isConnected = false;
  }
}

/**
 * Get a cached value. Returns null if not found or Redis unavailable.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!client || !isConnected) return null;

  try {
    const value = await client.get(key);
    if (value) {
      return JSON.parse(value) as T;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Set a cached value with TTL.
 */
export async function cacheSet(key: string, value: any, ttlSeconds: number): Promise<void> {
  if (!client || !isConnected) return;

  try {
    await client.setEx(key, ttlSeconds, JSON.stringify(value));
  } catch {
    // Caching is best-effort
  }
}

/**
 * Delete a cached key.
 */
export async function cacheDel(key: string): Promise<void> {
  if (!client || !isConnected) return;

  try {
    await client.del(key);
  } catch {
    // Best-effort
  }
}

/**
 * Build a cache key from parts.
 */
export function cacheKey(...parts: string[]): string {
  return `sunharvest:${parts.join(':')}`;
}

// Auto-connect on import (non-blocking)
connectRedis().catch(() => {});
