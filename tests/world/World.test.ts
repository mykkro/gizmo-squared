import { describe, expect, it } from 'vitest';
import { CHUNK_SIZE } from '../../src/config';
import { NO_ITEM } from '../../src/data/items';
import { chunkKey, localIndex, tileToChunk, tileToLocal } from '../../src/world/chunk';
import {
  World,
  reachableCount,
  ringOffsets,
  searchWalkable,
  type TileCoord,
} from '../../src/world/World';

describe('searchWalkable', () => {
  // Solid block around the origin with a sealed 1-tile pocket at (-1,-1), the first tile in
  // ring order. Everything beyond Chebyshev distance 2 is open.
  const isSolid = (x: number, y: number) =>
    Math.max(Math.abs(x), Math.abs(y)) <= 2 && !(x === -1 && y === -1);

  it('counts reachable tiles up to a limit', () => {
    expect(reachableCount(isSolid, -1, -1, 100)).toBe(1);
    expect(reachableCount(isSolid, 5, 5, 100)).toBe(100);
  });

  it('without a reach requirement it takes the sealed pocket', () => {
    expect(searchWalkable(isSolid, 0, 0, 64, 1)).toEqual({ tx: -1, ty: -1 });
  });

  it('with a reach requirement it skips sealed pockets', () => {
    const t = searchWalkable(isSolid, 0, 0, 64, 256);
    expect(t).not.toBeNull();
    expect(reachableCount(isSolid, t!.tx, t!.ty, 256)).toBe(256);
  });
});

/** Scans chunk by chunk (cache-friendly) for the first tile matching the predicate. */
function findTile(pred: (tx: number, ty: number) => boolean): TileCoord {
  for (let cy = 0; cy < 4; cy++) {
    for (let cx = 0; cx < 4; cx++) {
      for (let ly = 0; ly < CHUNK_SIZE; ly++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const tx = cx * CHUNK_SIZE + lx;
          const ty = cy * CHUNK_SIZE + ly;
          if (pred(tx, ty)) return { tx, ty };
        }
      }
    }
  }
  throw new Error('no matching tile in test area');
}

describe('ringOffsets', () => {
  it('returns the square ring at Chebyshev distance r', () => {
    expect(ringOffsets(0)).toEqual([[0, 0]]);
    expect(ringOffsets(1)).toHaveLength(8);
    expect(ringOffsets(2)).toHaveLength(16);
    for (const [dx, dy] of ringOffsets(3)) expect(Math.max(Math.abs(dx), Math.abs(dy))).toBe(3);
  });
});

describe('World', () => {
  it('caches chunks', () => {
    const w = new World('test');
    expect(w.getChunk(0, 0)).toBe(w.getChunk(0, 0));
    expect(w.hasChunk(0, 0)).toBe(true);
    expect(w.hasChunk(9, 9)).toBe(false);
  });

  it('takeItem removes the item and records a diff', () => {
    const w = new World('test');
    const t = findTile((x, y) => w.itemAt(x, y) !== NO_ITEM);
    const id = w.itemAt(t.tx, t.ty);
    expect(w.takeItem(t.tx, t.ty)).toBe(id);
    expect(w.itemAt(t.tx, t.ty)).toBe(NO_ITEM);
    const key = chunkKey(tileToChunk(t.tx), tileToChunk(t.ty));
    expect(w.exportDiffs()[key].picked).toContain(localIndex(tileToLocal(t.tx), tileToLocal(t.ty)));
  });

  it('takeItem on an empty tile returns NO_ITEM and records nothing', () => {
    const w = new World('test');
    const t = findTile((x, y) => w.itemAt(x, y) === NO_ITEM);
    expect(w.takeItem(t.tx, t.ty)).toBe(NO_ITEM);
    expect(w.exportDiffs()).toEqual({});
  });

  it('re-applies diffs when restored from a save', () => {
    const w = new World('test');
    const t = findTile((x, y) => w.itemAt(x, y) !== NO_ITEM);
    w.takeItem(t.tx, t.ty);
    const restored = new World('test', w.exportDiffs());
    expect(restored.itemAt(t.tx, t.ty)).toBe(NO_ITEM);
  });

  it('keeps picked items gone after the chunk is evicted and regenerated', () => {
    const w = new World('test', {}, 2);
    const t = findTile((x, y) => w.itemAt(x, y) !== NO_ITEM);
    w.takeItem(t.tx, t.ty);
    w.getChunk(50, 50);
    w.getChunk(51, 51);
    w.getChunk(52, 52);
    expect(w.itemAt(t.tx, t.ty)).toBe(NO_ITEM);
  });

  it('exportDiffs returns a copy', () => {
    const w = new World('test');
    const t = findTile((x, y) => w.itemAt(x, y) !== NO_ITEM);
    w.takeItem(t.tx, t.ty);
    const exported = w.exportDiffs();
    Object.values(exported)[0].picked.push(999);
    expect(Object.values(w.exportDiffs())[0].picked).not.toContain(999);
  });

  it('findSpawn returns a deterministic walkable tile', () => {
    const a = new World('spawn-test').findSpawn();
    const b = new World('spawn-test').findSpawn();
    expect(a).toEqual(b);
    expect(new World('spawn-test').isSolid(a.tx, a.ty)).toBe(false);
  });

  it('findWalkableNear returns the start when walkable, else a nearby walkable tile', () => {
    const w = new World('test');
    const open = findTile((x, y) => !w.isSolid(x, y));
    expect(w.findWalkableNear(open.tx, open.ty, 8)).toEqual(open);
    const solid = findTile((x, y) => w.isSolid(x, y));
    const r = w.findWalkableNear(solid.tx, solid.ty, 64);
    expect(r).not.toBeNull();
    expect(w.isSolid(r!.tx, r!.ty)).toBe(false);
  });
});
