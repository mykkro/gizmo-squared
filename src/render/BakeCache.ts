import { BAKED_CACHE_LIMIT, BAKES_PER_FRAME } from '../config';
import { LruCache } from '../core/lru';
import { chunkKey, type ChunkData } from '../world/chunk';
import type { CanvasLike } from './chunkBaker';

/** LRU of baked chunk canvases with a per-frame bake budget. */
export class BakeCache {
  private readonly cache: LruCache<string, CanvasLike>;
  private budget = 0;

  constructor(
    private readonly bake: (chunk: ChunkData) => CanvasLike,
    limit = BAKED_CACHE_LIMIT,
    private readonly perFrame = BAKES_PER_FRAME,
  ) {
    this.cache = new LruCache(limit);
  }

  get size(): number {
    return this.cache.size;
  }

  get bakesThisFrame(): number {
    return this.perFrame - this.budget;
  }

  beginFrame(): void {
    this.budget = this.perFrame;
  }

  /** Cached canvas, a fresh bake if budget remains, or undefined. */
  get(chunk: ChunkData): CanvasLike | undefined {
    const key = chunkKey(chunk.cx, chunk.cy);
    const hit = this.cache.get(key);
    if (hit) return hit;
    if (this.budget <= 0) return undefined;
    this.budget--;
    const canvas = this.bake(chunk);
    this.cache.set(key, canvas);
    return canvas;
  }
}
