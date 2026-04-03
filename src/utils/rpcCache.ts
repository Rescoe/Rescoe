type CacheEntry<T = unknown> = {
  data: T;
  ts: number;
};

class RpcCache {
  private cache = new Map<string, CacheEntry>();
  private ttl = 25_000; // 25s

  get<T = unknown>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.ts >= this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T = unknown>(key: string, data: T): void {
    this.cache.set(key, { data, ts: Date.now() });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

export const rpcCache = new RpcCache();

export const throttle = <T extends (...args: any[]) => void>(
  fn: T,
  delay: number
) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) return;

    timeout = setTimeout(() => {
      timeout = null;
      fn(...args);
    }, delay);
  };
};
