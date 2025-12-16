import { unstable_cache } from 'next/cache';

// Enhanced cache implementation with LRU eviction
class SimpleCache {
  private cache = new Map<string, { value: any; expiry: number }>();
  private maxSize = 100; // Max 100 items in cache

  set(key: string, value: any, ttl: number = 30000) {
    // LRU eviction - remove oldest if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    const expiry = Date.now() + ttl;
    this.cache.set(key, { value, expiry });
  }

  get(key: string) {
    const item = this.cache.get(key);
    if (!item) return undefined;

    // Check if expired
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return undefined;
    }

    return item.value;
  }

  delete(key: string) {
    return this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  // Cleanup expired items periodically
  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

export const cache = new SimpleCache();

// Run cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => cache.cleanup(), 5 * 60 * 1000);
}

export const createCacheKey = (endpoint: string, params: Record<string, any> = {}): string => {
  const paramString = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');

  return `${endpoint}${paramString ? `?${paramString}` : ''}`;
};

/**
 * Invalidate cache for a specific resource type
 * This is useful when data is created, updated, or deleted
 */
export const invalidateCache = (resource: string, companyId?: string) => {
  // Clear all cache entries that start with the resource name
  const cacheInstance = cache as any;
  const cacheMap = cacheInstance.cache as Map<string, any>;

  const keysToDelete: string[] = [];
  for (const [key] of cacheMap.entries()) {
    if (key.startsWith(resource)) {
      // If companyId is provided, only invalidate for that company
      if (companyId && !key.includes(`companyId=${companyId}`)) {
        continue;
      }
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach(key => cache.delete(key));
  return keysToDelete.length;
};

/**
 * Invalidate all caches for a company
 */
export const invalidateCompanyCache = (companyId: string) => {
  const cacheInstance = cache as any;
  const cacheMap = cacheInstance.cache as Map<string, any>;

  const keysToDelete: string[] = [];
  for (const [key] of cacheMap.entries()) {
    if (key.includes(`companyId=${companyId}`)) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach(key => cache.delete(key));
  return keysToDelete.length;
};

// Helper to create Next.js cached functions with automatic revalidation
export function createCachedQuery<T>(
  fn: (...args: any[]) => Promise<T>,
  options: {
    tags: string[];
    revalidate?: number;
  }
) {
  return unstable_cache(fn, options.tags, {
    revalidate: options.revalidate || 300, // 5 minutes default
    tags: options.tags
  });
}
