import { CHUNK_PX, CHUNK_SIZE, TILE_PX } from '../config';
import { BLOCKS, blockById } from '../data/blocks';
import { localIndex, type ChunkData } from '../world/chunk';
import { parseHex, shade, type RGB } from './color';
import { fillTerrainRect, type TerrainLookup } from './terrainSurface';

export type CanvasLike = OffscreenCanvas | HTMLCanvasElement;

/** Last pixel row/column of a block's inset square (blocks leave a 1 px terrain margin). */
const LAST = TILE_PX - 2;
const GRID = CHUNK_SIZE + 2;

const BLOCK_RGB: RGB[] = [];
const BLOCK_EDGE_RGB: RGB[] = [];
for (const b of BLOCKS) {
  BLOCK_RGB[b.id] = parseHex(b.color);
  BLOCK_EDGE_RGB[b.id] = shade(BLOCK_RGB[b.id], 0.7);
}

/**
 * Writes RGBA pixels for a whole chunk: blended, textured terrain, then blocks. `terrainAt`
 * supplies the one-tile margin around the chunk, so borders blend exactly like direct
 * sampling and neighbouring chunks meet without seams.
 */
export function fillChunkPixels(
  chunk: ChunkData,
  terrainAt: TerrainLookup,
  out: Uint8ClampedArray,
): void {
  const ox = chunk.cx * CHUNK_SIZE;
  const oy = chunk.cy * CHUNK_SIZE;
  const grid = new Uint8Array(GRID * GRID);
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const lx = gx - 1;
      const ly = gy - 1;
      const inside = lx >= 0 && ly >= 0 && lx < CHUNK_SIZE && ly < CHUNK_SIZE;
      grid[gy * GRID + gx] = inside
        ? chunk.terrain[localIndex(lx, ly)]
        : terrainAt(ox + lx, oy + ly);
    }
  }
  const local: TerrainLookup = (tx, ty) => grid[(ty - oy + 1) * GRID + (tx - ox + 1)];

  fillTerrainRect(ox * TILE_PX, oy * TILE_PX, CHUNK_PX, CHUNK_PX, local, out, CHUNK_PX);

  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const block = blockById(chunk.block[localIndex(lx, ly)]);
      if (!block) continue;
      for (let py = 1; py <= LAST; py++) {
        for (let px = 1; px <= LAST; px++) {
          const edge = px === 1 || px === LAST || py === 1 || py === LAST;
          const c = edge ? BLOCK_EDGE_RGB[block.id] : BLOCK_RGB[block.id];
          const o = ((ly * TILE_PX + py) * CHUNK_PX + lx * TILE_PX + px) * 4;
          out[o] = c[0];
          out[o + 1] = c[1];
          out[o + 2] = c[2];
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

export function bakeChunk(chunk: ChunkData, terrainAt: TerrainLookup): CanvasLike {
  const canvas = createCanvas(CHUNK_PX, CHUNK_PX);
  // Both canvas types expose the same 2D API we use; the cast avoids a union-overload error.
  const ctx = (canvas as HTMLCanvasElement).getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  const img = ctx.createImageData(CHUNK_PX, CHUNK_PX);
  fillChunkPixels(chunk, terrainAt, img.data);
  ctx.putImageData(img, 0, 0);
  return canvas;
}
