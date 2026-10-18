import { describe, expect, it } from 'vitest';
import { CHUNK_PX, TILE_PX } from '../../src/config';
import { BLOCKS, BLOCK_ID } from '../../src/data/blocks';
import { paintBlock } from '../../src/render/objects';
import { GIZMO_DEFS, ITEM_DEFS, rasterize } from '../../src/render/sprites';

const px = (x: number, y: number) => (y * CHUNK_PX + x) * 4;

describe('objects', () => {
  it('a boulder covers the tile centre and leaves the corners as terrain', () => {
    const out = new Uint8ClampedArray(CHUNK_PX * CHUNK_PX * 4).fill(10);
    paintBlock(BLOCK_ID.boulder, out, 0, 0);
    expect(out[px(TILE_PX / 2, TILE_PX / 2)]).not.toBe(10);
    expect(out[px(0, 0)]).toBe(10);
  });

  it('every block type paints something at its own offset only', () => {
    for (const b of BLOCKS) {
      const out = new Uint8ClampedArray(CHUNK_PX * CHUNK_PX * 4).fill(10);
      paintBlock(b.id, out, TILE_PX, TILE_PX);
      expect(out[px(TILE_PX + TILE_PX / 2, TILE_PX + TILE_PX / 2)], b.key).not.toBe(10);
      expect(out[px(TILE_PX / 2, TILE_PX / 2)], b.key).toBe(10);
    }
  });
});

describe('HD sprites', () => {
  it('scale with zoom and anti-alias their edges', () => {
    const img = rasterize(GIZMO_DEFS.walk[0], 3);
    expect([img.width, img.height]).toEqual([96, 96]);
    let partial = 0;
    for (let i = 3; i < img.data.length; i += 4)
      if (img.data[i] > 0 && img.data[i] < 255) partial++;
    expect(partial).toBeGreaterThan(50);
  });

  it('outline thickness scales with zoom (about 1 sprite unit)', () => {
    const darkCount = (scale: number) => {
      const img = rasterize(ITEM_DEFS.berry, scale);
      let n = 0;
      for (let i = 0; i < img.data.length; i += 4) {
        if (img.data[i + 3] > 200 && img.data[i] < 110 && img.data[i + 1] < 60) n++;
      }
      return n;
    };
    expect(darkCount(4) / darkCount(2)).toBeGreaterThan(2.5);
  });
});
