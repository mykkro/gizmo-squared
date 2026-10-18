export class LruCache<K, V> {
  private readonly map = new Map<K, V>();

  constructor(
    private readonly limit: number,
    private readonly onEvict?: (key: K, value: V) => void,
  ) {}

  get size(): number {
    return this.map.size;
  }

  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      this.map.delete(key);
      this.map.set(key, value);
    }
    return value;
  }

  peek(key: K): V | undefined {
    return this.map.get(key);
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  set(key: K, value: V): void {
    this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.limit) {
      const oldest = this.map.keys().next().value as K;
      const oldValue = this.map.get(oldest) as V;
      this.map.delete(oldest);
      this.onEvict?.(oldest, oldValue);
    }
  }
}
