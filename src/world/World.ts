import { CHUNK_CACHE_LIMIT } from '../config';
import { LruCache } from '../core/lru';
import { hashString } from '../core/rng';
import { BIOME_INDEX } from '../data/biomes';
import { NO_ITEM } from '../data/items';
import { chunkKey, localIndex, tileToChunk, tileToLocal, type ChunkData } from './chunk';
import { WorldGenerator } from './generator';

export interface ChunkDiff {
  /** Local tile indices whose item was collected. */
  picked: number[];
}

export interface TileCoord {
  tx: number;
  ty: number;
}

/** Offsets on the square ring at Chebyshev distance r. */
export function ringOffsets(r: number): Array<[number, number]> {
  if (r === 0) return [[0, 0]];
  const out: Array<[number, number]> = [];
  for (let d = -r; d <= r; d++) out.push([d, -r], [d, r]);
  for (let d = -r + 1; d <= r - 1; d++) out.push([-r, d], [r, d]);
  return out;
}

/** Tiles reachable from (tx, ty) by 4-way walking, counted up to `limit` (bounded flood fill). */
export function reachableCount(
  isSolid: (x: number, y: number) => boolean,
  tx: number,
  ty: number,
  limit: number,
): number {
  if (isSolid(tx, ty)) return 0;
  const seen = new Set([`${tx},${ty}`]);
  const queue: Array<[number, number]> = [[tx, ty]];
  for (let head = 0; head < queue.length && seen.size < limit; head++) {
    const [x, y] = queue[head];
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ]) {
      const key = `${nx},${ny}`;
      if (seen.has(key) || isSolid(nx, ny)) continue;
      seen.add(key);
      queue.push([nx, ny]);
      if (seen.size >= limit) break;
    }
  }
  return Math.min(seen.size, limit);
}

/** Nearest walkable tile (ring order) whose reachable area is at least `minReach` tiles. */
export function searchWalkable(
  isSolid: (x: number, y: number) => boolean,
  tx: number,
  ty: number,
  maxRadius: number,
  minReach: number,
): TileCoord | null {
  for (let r = 0; r <= maxRadius; r++) {
    for (const [dx, dy] of ringOffsets(r)) {
      const x = tx + dx;
      const y = ty + dy;
      if (isSolid(x, y)) continue;
      if (minReach <= 1 || reachableCount(isSolid, x, y, minReach) >= minReach) {
        return { tx: x, ty: y };
      }
    }
  }
  return null;
}

const SPAWN_BIOMES = new Set([BIOME_INDEX.Grassland, BIOME_INDEX.Forest]);

export class World {
  readonly seed: number;
  readonly generator: WorldGenerator;
  private readonly chunks: LruCache<string, ChunkData>;
  private readonly diffs = new Map<string, ChunkDiff>();

  constructor(
    readonly seedText: string,
    diffs: Record<string, ChunkDiff> = {},
    chunkCacheLimit = CHUNK_CACHE_LIMIT,
  ) {
    this.seed = hashString(seedText);
    this.generator = new WorldGenerator(this.seed);
    this.chunks = new LruCache(chunkCacheLimit);
    for (const [key, d] of Object.entries(diffs)) this.diffs.set(key, { picked: [...d.picked] });
  }

  get loadedChunkCount(): number {
    return this.chunks.size;
  }

  hasChunk(cx: number, cy: number): boolean {
    return this.chunks.has(chunkKey(cx, cy));
  }

  getChunk(cx: number, cy: number): ChunkData {
    const key = chunkKey(cx, cy);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = this.generator.generateChunk(cx, cy);
      const diff = this.diffs.get(key);
      if (diff) for (const i of diff.picked) chunk.item[i] = NO_ITEM;
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  private locate(tx: number, ty: number): [ChunkData, number] {
    const chunk = this.getChunk(tileToChunk(tx), tileToChunk(ty));
    return [chunk, localIndex(tileToLocal(tx), tileToLocal(ty))];
  }

  isSolid(tx: number, ty: number): boolean {
    const [c, i] = this.locate(tx, ty);
    return c.solid[i] === 1;
  }

  biomeAt(tx: number, ty: number): number {
    const [c, i] = this.locate(tx, ty);
    return c.biome[i];
  }

  terrainAt(tx: number, ty: number): number {
    const [c, i] = this.locate(tx, ty);
    return c.terrain[i];
  }

  itemAt(tx: number, ty: number): number {
    const [c, i] = this.locate(tx, ty);
    return c.item[i];
  }

  /** Removes the item on a tile, records it in the diff, and returns its id (or NO_ITEM). */
  takeItem(tx: number, ty: number): number {
    const [c, i] = this.locate(tx, ty);
    const id = c.item[i];
    if (id === NO_ITEM) return NO_ITEM;
    c.item[i] = NO_ITEM;
    const key = chunkKey(c.cx, c.cy);
    const diff = this.diffs.get(key) ?? { picked: [] };
    diff.picked.push(i);
    this.diffs.set(key, diff);
    return id;
  }

  exportDiffs(): Record<string, ChunkDiff> {
    const out: Record<string, ChunkDiff> = {};
    for (const [key, d] of this.diffs) out[key] = { picked: [...d.picked] };
    return out;
  }

  private search(
    tx: number,
    ty: number,
    maxRadius: number,
    accept: (x: number, y: number) => boolean,
  ): TileCoord | null {
    for (let r = 0; r <= maxRadius; r++) {
      for (const [dx, dy] of ringOffsets(r)) {
        if (accept(tx + dx, ty + dy)) return { tx: tx + dx, ty: ty + dy };
      }
    }
    return null;
  }

  /** Nearest walkable tile from which at least `minReach` tiles can be walked to. */
  findWalkableNear(tx: number, ty: number, maxRadius: number, minReach = 1): TileCoord | null {
    return searchWalkable((x, y) => this.isSolid(x, y), tx, ty, maxRadius, minReach);
  }

  /** Nearest walkable tile to the origin, preferring Grassland or Forest within 64 tiles. */
  findSpawn(): TileCoord {
    return (
      this.search(
        0,
        0,
        64,
        (x, y) => !this.isSolid(x, y) && SPAWN_BIOMES.has(this.biomeAt(x, y)),
      ) ??
      this.findWalkableNear(0, 0, 256) ?? { tx: 0, ty: 0 }
    );
  }
}
