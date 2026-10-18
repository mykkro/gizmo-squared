import { describe, expect, it } from 'vitest';
import { LruCache } from '../../src/core/lru';

describe('LruCache', () => {
  it('evicts the least recently used entry and reports it', () => {
    const evicted: string[] = [];
    const c = new LruCache<string, number>(2, (k) => evicted.push(k));
    c.set('a', 1);
    c.set('b', 2);
    c.get('a');
    c.set('c', 3);
    expect(c.peek('b')).toBeUndefined();
    expect(c.get('a')).toBe(1);
    expect(c.get('c')).toBe(3);
    expect(evicted).toEqual(['b']);
    expect(c.size).toBe(2);
  });

  it('replacing an existing key does not evict', () => {
    const evicted: string[] = [];
    const c = new LruCache<string, number>(2, (k) => evicted.push(k));
    c.set('a', 1);
    c.set('b', 2);
    c.set('a', 10);
    expect(evicted).toEqual([]);
    expect(c.get('a')).toBe(10);
  });

  it('peek does not refresh recency', () => {
    const c = new LruCache<string, number>(2);
    c.set('a', 1);
    c.set('b', 2);
    c.peek('a');
    c.set('c', 3);
    expect(c.has('a')).toBe(false);
  });
});
