# Terrain rendering 2.0 (smooth HD) Implementation Plan

> **For agentic workers:** Execute inline (superpowers:executing-plans), test-first per task.

**Goal:** Smooth HD rendering: procedural seamless terrain textures with organic blending, anti-aliased objects and sprites, continuous zoom, soft fog of war, and minimap colours that match.

**Architecture:** New pure modules (`render/texnoise.ts`, `render/textures.ts`, `render/terrainSurface.ts`, `render/objects.ts`, plus the sprite rasteriser in `render/sprites.ts`) produce pixels from world coordinates. `chunkBaker` composes them per chunk. `Renderer` draws chunks into device-pixel rectangles with smoothing, HD sprites, and the fog overlay.

**Spec:** `docs/superpowers/specs/2026-10-18-terrain-hd-design.md`

**Deviation from the usual plan format (ruling):** each task gives its tests in full plus the key algorithm. The final code is written during execution under TDD, so it isn't duplicated here. Cost if this goes wrong: details get settled at implementation time and are recorded as rulings.

## Global constraints

- Every pixel the renderer bakes depends only on world coordinates and fixed texture seeds. No `Math.random`.
- Generated textures are 128 × 128 (`TEX_PX`) and seamless: wrap-around noise uses integer periods.
- `BAKES_PER_FRAME = 1`. Texture generation is lazy (on first use of each terrain).
- Run format, lint, tsc and the full test suite before every commit; commits end with the Co-Authored-By line.

## Review focus

1. **Chunk seams.** Edge pixels of adjacent baked chunks must equal direct `terrainColorAt` sampling (Task 3 test).
2. **Gaps between chunks at fractional zoom.** Chunks are drawn into rounded device rectangles where each one starts exactly where the previous ended (Task 5, `chunkRect` test).
3. **Texture tiling seams.** Texture column 127 must continue smoothly into column 0 (Task 2 test: wrap difference no larger than the typical neighbour difference).
4. **Bake cost.** One chunk bake must stay well under one frame (the Task 3 test logs the time; the debug overlay shows it).
5. **Sprite outline at large zoom** must stay about 1 sprite unit thick, not 1 device pixel (Task 4 test checks that outline coverage scales with zoom).

---

### Task 1: Tileable noise kit

**Files:** create `src/render/texnoise.ts`, `tests/render/texnoise.test.ts`

**Produces:**
- `valueNoise(x, y, px, py, seed): number`: 0..1, seamless with period `px` × `py` lattice cells over [0, 1)².
- `fbm(x, y, period, octaves, seed): number`
- `cellular(x, y, period, seed): { f1: number; f2: number }`: distances in cell units.

Here x, y are in [0, 1) texture space.

Tests:
```ts
import { describe, expect, it } from 'vitest';
import { cellular, fbm, valueNoise } from '../../src/render/texnoise';

const N = 128;
const at = (f: (x: number, y: number) => number, i: number, j: number) => f(i / N, j / N);

describe('texnoise', () => {
  it.each([
    ['valueNoise', (x: number, y: number) => valueNoise(x, y, 4, 4, 1)],
    ['fbm', (x: number, y: number) => fbm(x, y, 4, 4, 2)],
    ['cellular f1', (x: number, y: number) => cellular(x, y, 5, 3).f1],
  ])('%s is seamless: the wrap step is like any other step', (_n, f) => {
    let maxStep = 0;
    let wrapStep = 0;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N - 1; i++) maxStep = Math.max(maxStep, Math.abs(at(f, i + 1, j) - at(f, i, j)));
      wrapStep = Math.max(wrapStep, Math.abs(at(f, 0, j) - at(f, N - 1, j)));
    }
    expect(wrapStep).toBeLessThanOrEqual(maxStep * 1.05 + 1e-9);
  });

  it('is deterministic and in range', () => {
    expect(fbm(0.3, 0.7, 4, 3, 9)).toBe(fbm(0.3, 0.7, 4, 3, 9));
    for (let i = 0; i < 500; i++) {
      const v = fbm((i * 0.37) % 1, (i * 0.61) % 1, 4, 4, 5);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('cellular f2 >= f1', () => {
    for (let i = 0; i < 200; i++) {
      const c = cellular((i * 0.13) % 1, (i * 0.29) % 1, 6, 1);
      expect(c.f2).toBeGreaterThanOrEqual(c.f1);
    }
  });
});
```

Key algorithm: lattice values `hash2(seed, ix mod px, iy mod py)` with smoothstep interpolation. `fbm` doubles the period each octave and normalises by the amplitude sum. `cellular` places one hashed feature point per cell in a `period` grid (indices wrap mod period) and scans 3 × 3 neighbours with wrapped indices, keeping actual offsets.

### Task 2: Terrain textures

**Files:** create `src/render/textures.ts`, `tests/render/textures.test.ts`

**Produces:** `TEX_PX = 128`; `getTexture(terrainIndex): Uint8ClampedArray` (RGB, TEX_PX² × 3, cached); `texel(terrainIndex, wx, wy): [r, g, b]` (wraps world pixels); `averageRGB(terrainIndex): RGB`.

Recipes per terrain key: `{ palette: string[]; kind: 'fbm' | 'streaks' | 'ripples' | 'waves' | 'cells' | 'speckle'; scale: number; accent?: 'sparkle' | 'cracks' | 'glow' | 'algae' }`.

Tests:
```ts
import { describe, expect, it } from 'vitest';
import { TERRAINS } from '../../src/data/terrains';
import { TEX_PX, averageRGB, getTexture, texel } from '../../src/render/textures';

describe('terrain textures', () => {
  it('exist for every terrain with the right size and are cached', () => {
    TERRAINS.forEach((_, i) => {
      const t = getTexture(i);
      expect(t.length).toBe(TEX_PX * TEX_PX * 3);
      expect(getTexture(i)).toBe(t);
    });
  });

  it('wrap in world space (texel repeats every TEX_PX)', () => {
    expect(texel(0, 5, 7)).toEqual(texel(0, 5 + TEX_PX, 7 - 3 * TEX_PX));
  });

  it('are textured (not flat) and seamless across the wrap', () => {
    TERRAINS.forEach((t, i) => {
      const tex = getTexture(i);
      const lum = (x: number, y: number) => {
        const o = (y * TEX_PX + x) * 3;
        return tex[o] * 0.3 + tex[o + 1] * 0.59 + tex[o + 2] * 0.11;
      };
      let min = 255, max = 0, inner = 0, wrap = 0;
      for (let y = 0; y < TEX_PX; y++) {
        for (let x = 0; x < TEX_PX; x++) {
          min = Math.min(min, lum(x, y));
          max = Math.max(max, lum(x, y));
        }
        inner += Math.abs(lum(64, y) - lum(63, y));
        wrap += Math.abs(lum(0, y) - lum(TEX_PX - 1, y));
      }
      expect(max - min, t.key).toBeGreaterThan(12);
      expect(wrap, t.key).toBeLessThan(inner * 2.5 + TEX_PX * 4);
    });
  });

  it('average colour is close to the terrain base colour family', () => {
    TERRAINS.forEach((_, i) => {
      const a = averageRGB(i);
      a.forEach((c) => expect(c).toBeGreaterThanOrEqual(0));
    });
  });
});
```

(Sparkles and cracks make single-pixel jumps legitimate, so the seam test compares summed column differences with a tolerance rather than requiring exact smoothness.)

### Task 3: Terrain surface (blending) and chunk bake

**Files:** create `src/render/terrainSurface.ts`, `tests/render/terrainSurface.test.ts`; modify `src/render/chunkBaker.ts`, `tests/render/render.test.ts` (fillChunkPixels test), `src/config.ts` (`BAKES_PER_FRAME = 1`).

**Produces:**
- `terrainColorAt(wx, wy, terrainAt): RGB` (pure).
- `bakeTerrainPixels(cx, cy, terrainAt, out)`, used by `fillChunkPixels(chunk, terrainAt, out)`.
- `fillChunkPixels` signature changes to `(chunk: ChunkData, terrainAt: (tx, ty) => number, out)`. `bakeChunk(chunk, terrainAt)`. The Renderer passes `(tx, ty) => world.generator.sampleTile(tx, ty).terrain` for margin tiles (the chunk's own array is used inside the chunk).

Tests:
```ts
import { describe, expect, it } from 'vitest';
import { CHUNK_PX, CHUNK_SIZE, TILE_PX } from '../../src/config';
import { TERRAIN_INDEX } from '../../src/data/terrains';
import { fillChunkPixels } from '../../src/render/chunkBaker';
import { terrainColorAt } from '../../src/render/terrainSurface';
import { texel } from '../../src/render/textures';
import { createChunkData } from '../../src/world/chunk';
import { WorldGenerator } from '../../src/world/generator';

const G = TERRAIN_INDEX.grass;
const S = TERRAIN_INDEX.sand;
const half = (tx: number) => (tx < 0 ? S : G);

describe('terrain surface', () => {
  it('uniform areas are the plain texture', () => {
    expect(terrainColorAt(200, 200, () => G)).toEqual(texel(G, 200, 200));
  });

  it('pure on each side, mixed near the border', () => {
    expect(terrainColorAt(3 * TILE_PX, 10, half)).toEqual(texel(G, 3 * TILE_PX, 10));
    expect(terrainColorAt(-3 * TILE_PX, 10, half)).toEqual(texel(S, -3 * TILE_PX, 10));
    let mixed = 0;
    for (let y = 0; y < 256; y++) {
      const c = terrainColorAt(0, y, half);
      if (c.join() !== texel(G, 0, y).join() && c.join() !== texel(S, 0, y).join()) mixed++;
    }
    expect(mixed).toBeGreaterThan(64);
  });

  it('baked chunks agree with direct sampling at their shared edge (no seams)', () => {
    const gen = new WorldGenerator(77);
    const terrainAt = (tx: number, ty: number) => gen.sampleTile(tx, ty).terrain;
    const a = new Uint8ClampedArray(CHUNK_PX * CHUNK_PX * 4);
    const b = new Uint8ClampedArray(CHUNK_PX * CHUNK_PX * 4);
    const ca = gen.generateChunk(0, 0);
    const cb = gen.generateChunk(1, 0);
    const t0 = performance.now();
    fillChunkPixels(ca, terrainAt, a);
    console.log(`bake ms: ${(performance.now() - t0).toFixed(1)}`);
    fillChunkPixels(cb, terrainAt, b);
    let mismatches = 0;
    for (let y = 0; y < CHUNK_PX; y++) {
      const left = terrainColorAt(CHUNK_PX - 1, y, terrainAt);
      const right = terrainColorAt(CHUNK_PX, y, terrainAt);
      const oa = (y * CHUNK_PX + CHUNK_PX - 1) * 4;
      const ob = (y * CHUNK_PX) * 4;
      if (ca.block[Math.floor(y / TILE_PX) * CHUNK_SIZE + CHUNK_SIZE - 1] === 0 &&
          [a[oa], a[oa + 1], a[oa + 2]].join() !== left.join()) mismatches++;
      if (cb.block[Math.floor(y / TILE_PX) * CHUNK_SIZE] === 0 &&
          [b[ob], b[ob + 1], b[ob + 2]].join() !== right.join()) mismatches++;
    }
    expect(mismatches).toBe(0);
  });
});
```

Key algorithm: `u = wx / T - 0.5`, `v = wy / T - 0.5`; tiles at `floor(u|v)` and +1; bilinear weights. If all four terrains are equal, return a single texel. Otherwise, for each distinct terrain, the weight sum × `(0.35 + 1.3 × blendNoise_t(wx, wy))`, raised to the power 3 and normalised; mix the texels. `blendNoise_t` is a precomputed 256 × 256 tileable fBm table sampled at `(wx + 97t, wy + 53t) mod 256`. The chunk bake uses a local (CHUNK + 2)² terrain grid with margins taken from `terrainAt`.

### Task 4: Anti-aliased objects and HD sprites

**Files:** create `src/render/objects.ts`, `tests/render/objects.test.ts`; modify `src/render/sprites.ts` (export the shape definitions and add `rasterize`), `src/render/chunkBaker.ts` (paint blocks via objects), `tests/render/render.test.ts`.

**Produces:**
- `paintBlock(blockId, out, ox, oy)`: composites a shaded AA shape over the tile at pixel offset (ox, oy) in a CHUNK_PX-wide RGBA buffer.
- `SpriteDef { w; h; palette; outline; shape; under? }`; `GIZMO_DEFS`, `ITEM_DEFS`.
- `rasterize(def, scale): { width; height; data: Uint8ClampedArray }` (RGBA, premultiplied → straight alpha), 2 × 2 supersampling, outline in sprite units.
- `paint` stays, for PixelSprite tests.

Tests:
```ts
import { describe, expect, it } from 'vitest';
import { CHUNK_PX, TILE_PX } from '../../src/config';
import { BLOCK_ID } from '../../src/data/blocks';
import { paintBlock } from '../../src/render/objects';
import { GIZMO_DEFS, ITEM_DEFS, rasterize } from '../../src/render/sprites';

describe('objects', () => {
  it('a boulder covers the tile centre and leaves the corners as terrain', () => {
    const out = new Uint8ClampedArray(CHUNK_PX * CHUNK_PX * 4).fill(10);
    paintBlock(BLOCK_ID.boulder, out, 0, 0);
    const px = (x: number, y: number) => (y * CHUNK_PX + x) * 4;
    expect(out[px(TILE_PX / 2, TILE_PX / 2)]).not.toBe(10);
    expect(out[px(0, 0)]).toBe(10);
  });
});

describe('HD sprites', () => {
  it('scale with zoom and anti-alias their edges', () => {
    const img = rasterize(GIZMO_DEFS.walk[0], 3);
    expect([img.width, img.height]).toEqual([96, 96]);
    let partial = 0;
    for (let i = 3; i < img.data.length; i += 4) if (img.data[i] > 0 && img.data[i] < 255) partial++;
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
```

### Task 5: Renderer: smooth, continuous zoom, HD sprites, fog

**Files:** modify `src/render/camera.ts`, `src/render/Renderer.ts`, `src/style.css`, `tests/render/render.test.ts`, `tests/render/smoothness.test.ts`; create `src/render/fog.ts`, `tests/render/fog.test.ts`.

**Produces:**
- `computeZoom(shortSide)` = clamp(short / (TILE_PX × 14), 0.5, 8) (float).
- `chunkRect(index, chunkPx, zoom, originF): [start, size]` with rounded start and end; adjacent rectangles touch exactly.
- `fogMask(explored, c0x, c0y, w, h): Uint8ClampedArray` (one alpha byte per cell: 0 explored, 255 not).

Tests:
```ts
// camera (replaces the integer-zoom test)
it('zoom is continuous: about 14 tiles on the short side', () => {
  expect(computeZoom(1120)).toBeCloseTo(2.5);
  expect(computeZoom(100)).toBe(0.5);
  for (const s of [700, 1080, 1500]) expect(s / (TILE_PX * computeZoom(s))).toBeCloseTo(14);
});
it('chunk rectangles tile without gaps or overlap at fractional zoom', () => {
  for (const z of [1.37, 2.5, 3.14159]) {
    for (let i = -5; i < 5; i++) {
      const [a, sa] = chunkRect(i, 512, z, 640.3);
      const [b] = chunkRect(i + 1, 512, z, 640.3);
      expect(a + sa).toBe(b);
    }
  }
});
// fog
it('fog mask: explored cells transparent, unexplored opaque', () => {
  const m = new ExploredMap();
  m.reveal(0, 0);
  const mask = fogMask(m, -2, -2, 4, 4);
  expect(mask[2 * 4 + 2]).toBe(0);       // cell (0,0)
  const far = fogMask(m, 50, 50, 1, 1);
  expect(far[0]).toBe(255);
});
```
The smoothness test switches to the float zoom (2.5) and must stay within ±1 device px.

### Task 6: Minimap 1 tile per pixel with texture colours, debug bake time, verification

**Files:** modify `src/render/minimap.ts`, `tests/render/minimap.test.ts`, `src/main.ts` (bake ms in the overlay), the e2e script; run the full suite and the browser check, look at the screenshots, commit.

Test changes: `TILES_PER_MAP_PX === 1`, `MAP_PX * TILES_PER_MAP_PX === 160`. Colour expectations use `averageRGB(index)` instead of `parseHex`.
