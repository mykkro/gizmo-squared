import { CHUNK_PX, CHUNK_SIZE, TILE_PX } from '../config';
import { hash2 } from '../core/rng';
import { BLOCKS, blockById } from '../data/blocks';
import { TERRAINS } from '../data/terrains';
import { localIndex, type ChunkData } from '../world/chunk';
import { SALT } from '../world/generator';
import { parseHex, shade, type RGB } from './color';

export type CanvasLike = OffscreenCanvas | HTMLCanvasElement;

/** Last pixel row/column of a block's inset square (blocks leave a 1 px terrain margin). */
const LAST = TILE_PX - 2;

/** ±4% per-tile brightness so flat areas aren't dead flat. */
export const SHADE_VARIATION = 0.04;

const TERRAIN_RGB: RGB[] = TERRAINS.map((t) => parseHex(t.color));
const BLOCK_RGB: RGB[] = [];
const BLOCK_EDGE_RGB: RGB[] = [];
for (const b of BLOCKS) {
  BLOCK_RGB[b.id] = parseHex(b.color);
  BLOCK_EDGE_RGB[b.id] = shade(BLOCK_RGB[b.id], 0.7);
}

/** Writes RGBA pixels for a whole chunk. Pure; sub-project 2 replaces the terrain part. */
export function fillChunkPixels(chunk: ChunkData, seed: number, out: Uint8ClampedArray): void {
  const ox = chunk.cx * CHUNK_SIZE;
  const oy = chunk.cy * CHUNK_SIZE;
  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const i = localIndex(lx, ly);
      const factor = 1 + (hash2(seed, ox + lx, oy + ly, SALT.shade) * 2 - 1) * SHADE_VARIATION;
      const base = shade(TERRAIN_RGB[chunk.terrain[i]], factor);
      const block = blockById(chunk.block[i]);
      for (let py = 0; py < TILE_PX; py++) {
        for (let px = 0; px < TILE_PX; px++) {
          let c = base;
          if (block && px >= 1 && px <= LAST && py >= 1 && py <= LAST) {
            const edge = px === 1 || px === LAST || py === 1 || py === LAST;
            c = edge ? BLOCK_EDGE_RGB[block.id] : BLOCK_RGB[block.id];
          }
          const o = ((ly * TILE_PX + py) * CHUNK_PX + lx * TILE_PX + px) * 4;
          out[o] = c[0];
          out[o + 1] = c[1];
          out[o + 2] = c[2];
          out[o + 3] = 255;
        }
      }
    }
  }
}

export function createCanvas(w: number, h: number): CanvasLike {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function bakeChunk(chunk: ChunkData, seed: number): CanvasLike {
  const canvas = createCanvas(CHUNK_PX, CHUNK_PX);
  // Both canvas types expose the same 2D API we use; the cast avoids a union-overload error.
  const ctx = (canvas as HTMLCanvasElement).getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  const img = ctx.createImageData(CHUNK_PX, CHUNK_PX);
  fillChunkPixels(chunk, seed, img.data);
  ctx.putImageData(img, 0, 0);
  return canvas;
}
