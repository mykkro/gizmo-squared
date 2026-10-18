# Rugged terrain and buildings Implementation Plan

> Execute inline (superpowers:executing-plans), test-first per task. Same format as the terrain HD plan: tests and key algorithms are given here, and the code is written under TDD.

**Spec:** `docs/superpowers/specs/2026-10-18-rugged-terrain-buildings-design.md`

## Global constraints
- Everything is a pure function of world or texture coordinates. Textures stay seamless with integer periods.
- Chunk bake output must equal direct `terrainColorAt` sampling (seam test).
- `BAKES_PER_FRAME = 1`. Check bake time in the debug overlay; it should stay at a few milliseconds.
- Run format, lint, tsc and the full test suite before every commit.

## Review focus
1. Seams after adding world-scale variation: the seam test must still pass.
2. Building painting near chunk edges must never write out of bounds (test with a building flush against the chunk's right and bottom edges).
3. House footprints solid: the player must not be able to walk under roofs (generator test).
4. Material textures must be seamless (wrap test).

### Task 1: Rugged, larger terrain textures
Files: `src/render/textures.ts`, `tests/render/textures.test.ts`.

New test:
```ts
it('are rugged: mean neighbour luminance difference is noticeable', () => {
  TERRAINS.forEach((t, i) => {
    const tex = getTexture(i);
    const lum = (x: number, y: number) => {
      const o = (y * TEX_PX + x) * 3;
      return tex[o] * 0.3 + tex[o + 1] * 0.59 + tex[o + 2] * 0.11;
    };
    let sum = 0;
    let n = 0;
    for (let y = 0; y < TEX_PX; y += 2) {
      for (let x = 0; x < TEX_PX - 1; x += 2) {
        sum += Math.abs(lum(x + 1, y) - lum(x, y));
        n++;
      }
    }
    expect(sum / n, t.key).toBeGreaterThan(4);
  });
});
it('are 256 px', () => expect(TEX_PX).toBe(256));
```
Key algorithm: add grain `(hash2(seed, px, py, 11) - 0.5) * 0.12`; add a `ridged` option and details as in the spec (cellular F1 thresholds for pebbles and stones, with a lit or shadowed side chosen by the offset direction to the feature point); recipe scales ×2.

### Task 2: World-scale variation
Files: `src/render/terrainSurface.ts`, `tests/render/terrainSurface.test.ts`.

Tests:
- Uniform areas equal the texel times the macro tint: within 15% of `texel`, and not always equal.
- `terrainColorAt(10, 10, () => G)` differs from `terrainColorAt(10 + 3 * TEX_PX, 10, () => G)`.
- The seam test still passes.

Key algorithm: `macro(tx, ty) = 1 + 0.2 * (n(tx, ty) - 0.5)`, where n is a fixed-seed `makeFractalNoise` with scale 8 tiles. In the cell, m = bilinear of the four tile macros (same fx, fy). Apply `r *= m * (1 + k)`, `g *= m`, `b *= m * (1 - k)` with `k = (m - 1) * 0.6`. `fillTerrainRect` precomputes macro values per tile in the cell loop. A shared `finishPixel` keeps both paths identical.

### Task 3: Materials
Files: create `src/render/materials.ts`, `tests/render/materials.test.ts`.

Produces: `MATERIAL_PX = 64`; `type Material = 'clay' | 'slate' | 'thatch' | 'shingle' | 'plaster' | 'brick' | 'planks' | 'stone' | 'paving'`; `materialTexel(m, x, y): RGB` (wraps).

Tests: for each material, deterministic; textured (luminance range > 20); seamless (summed wrap-column difference < 2.5 × inner column difference + 4 × MATERIAL_PX); clay, slate and brick show row structure (row-average luminance varies periodically, with a dark band every 8 px).

Key algorithm: rows 8 px with half-tile offsets on alternate rows; tile widths divide 64; per-tile hash colour variation; 1 px gaps; a shadow on the bottom 2 px of each row (roofs); shingle widths from hashed boundaries per row; stone and paving from cellular F2 - F1 gaps.

### Task 4: Building data, placement record, solid footprints
Files: `src/data/buildings.ts`, `src/world/chunk.ts` (`buildings: PlacedBuilding[]`), `src/world/generator.ts`, `tests/world/generator.test.ts`, `tests/data/data.test.ts`.

Tests:
```ts
it('records placed buildings, fully inside the chunk, with solid house footprints', () => {
  const g = new WorldGenerator(SEED);
  let houses = 0;
  for (let cy = -6; cy < 6; cy++) for (let cx = -6; cx < 6; cx++) {
    const c = g.generateChunk(cx, cy);
    for (const b of c.buildings) {
      const def = BUILDINGS[b.index];
      const w = def.blueprint[0].length, h = def.blueprint.length;
      expect(b.ox + w).toBeLessThanOrEqual(CHUNK_SIZE);
      expect(b.oy + h).toBeLessThanOrEqual(CHUNK_SIZE);
      if (def.kind !== 'house') continue;
      houses++;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        expect(c.solid[localIndex(b.ox + x, b.oy + y)]).toBe(1);
        expect(c.item[localIndex(b.ox + x, b.oy + y)]).toBe(NO_ITEM);
      }
    }
  }
  expect(houses).toBeGreaterThan(0);
});
```
Data test: houses have a roof and a wall; open structures have neither.

### Task 5: Building painter and bake integration
Files: create `src/render/buildingPainter.ts`, `tests/render/buildingPainter.test.ts`; modify `src/render/chunkBaker.ts`, `src/render/objects.ts` (masonry bricks).

Produces: `paintBuilding(b: PlacedBuilding, out: Uint8ClampedArray)` (CHUNK_PX-wide RGBA, local coordinates).

Tests:
- Painting a small house at (2, 2) on a uniform background: the roof's top-centre pixel and the front-wall centre-bottom pixel (door) differ from the background; the door pixel is dark (luminance < 90); a pixel two tiles left of the footprint is unchanged; a shadow pixel just right of and below the footprint is darker than the background.
- Painting a barn flush at (CHUNK_SIZE - 7, CHUNK_SIZE - 5): no exception, and the buffer length is unchanged.
- Open shrine: its `.` tiles are painted with paving (they differ from the background).

### Task 6: Verify, screenshots, README, push
Run the full suite and lint; run the browser check; take before and after screenshots of the same seed and route; update `docs/screenshot.png`; final whole-branch review (fresh reviewer); fix Important findings test-first; merge to main; `git push -u origin main`.
