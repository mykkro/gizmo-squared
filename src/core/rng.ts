/** FNV-1a 32-bit hash; turns seed text into a numeric seed. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stateless hash of (seed, x, y, salt) to a float in [0, 1). */
export function hash2(seed: number, x: number, y: number, salt = 0): number {
  let h =
    (seed ^
      Math.imul(x | 0, 0x27d4eb2d) ^
      Math.imul(y | 0, 0x165667b1) ^
      Math.imul(salt | 0, 0x9e3779b9)) |
    0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Pick a key using a uniform u in [0, 1). Keys with weight <= 0 never win. */
export function pickWeighted<K extends string>(
  weights: Partial<Record<K, number>>,
  u: number,
): K | null {
  let total = 0;
  for (const k in weights) total += Math.max(0, weights[k] ?? 0);
  if (total <= 0) return null;
  let r = u * total;
  let last: K | null = null;
  for (const k in weights) {
    const w = Math.max(0, weights[k] ?? 0);
    if (w <= 0) continue;
    last = k;
    if (r < w) return k;
    r -= w;
  }
  return last;
}
