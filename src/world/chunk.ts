import { CHUNK_SIZE } from '../config';

export interface ChunkData {
  readonly cx: number;
  readonly cy: number;
  /** Terrain index into TERRAINS. */
  readonly terrain: Uint8Array;
  /** Biome index into BIOMES. */
  readonly biome: Uint8Array;
  /** Item id (NO_ITEM = 0). */
  readonly item: Uint8Array;
  /** Block id (NO_BLOCK = 0). */
  readonly block: Uint8Array;
  /** 1 when impassable (solid terrain or a block). */
  readonly solid: Uint8Array;
}

const AREA = CHUNK_SIZE * CHUNK_SIZE;

export function createChunkData(cx: number, cy: number): ChunkData {
  return {
    cx,
    cy,
    terrain: new Uint8Array(AREA),
    biome: new Uint8Array(AREA),
    item: new Uint8Array(AREA),
    block: new Uint8Array(AREA),
    solid: new Uint8Array(AREA),
  };
}

export function localIndex(lx: number, ly: number): number {
  return ly * CHUNK_SIZE + lx;
}

export function chunkKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

export function tileToChunk(t: number): number {
  return Math.floor(t / CHUNK_SIZE);
}

export function tileToLocal(t: number): number {
  return ((t % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
}
