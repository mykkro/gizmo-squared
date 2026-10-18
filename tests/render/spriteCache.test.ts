import { describe, expect, it } from 'vitest';
import { SpriteCache, spriteScale } from '../../src/render/spriteCache';

describe('spriteScale', () => {
  it('quantises the zoom upward to steps of 0.25', () => {
    expect(spriteScale(2.41)).toBe(2.5);
    expect(spriteScale(2.49)).toBe(2.5);
    expect(spriteScale(2.5)).toBe(2.5);
    expect(spriteScale(2.51)).toBe(2.75);
  });
});

describe('SpriteCache', () => {
  const defs = ['gizmo', 'berry', 'leaf'];

  it('small zoom changes inside a step do not rebuild anything', () => {
    let builds = 0;
    const cache = new SpriteCache<string, string>((d, s) => {
      builds++;
      return `${d}@${s}`;
    });
    cache.beginFrame();
    for (const d of defs) cache.get(d, 2.41);
    cache.beginFrame();
    for (const d of defs) expect(cache.get(d, 2.45)).toBe(`${d}@2.5`);
    expect(builds).toBe(3);
  });

  it('after a real zoom change, rebuilds one stale sprite per frame and serves the rest stale', () => {
    let builds = 0;
    const cache = new SpriteCache<string, string>((d, s) => {
      builds++;
      return `${d}@${s}`;
    });
    cache.beginFrame();
    for (const d of defs) cache.get(d, 2);
    builds = 0;
    cache.beginFrame();
    const got = defs.map((d) => cache.get(d, 3));
    expect(builds).toBe(1);
    expect(got).toEqual(['gizmo@3', 'berry@2', 'leaf@2']);
    cache.beginFrame();
    expect(cache.get('berry', 3)).toBe('berry@3');
  });

  it('a sprite never seen before is built even when the budget is spent', () => {
    const cache = new SpriteCache<string, string>((d, s) => `${d}@${s}`);
    cache.beginFrame();
    cache.get('gizmo', 2);
    expect(cache.get('new', 2)).toBe('new@2');
  });
});
