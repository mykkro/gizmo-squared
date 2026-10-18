# Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Gizmo's World on Vite + TypeScript + Canvas 2D with a seeded, seamless, noise-based infinite world, a baked-chunk pixel-art renderer, keyboard and touch input, cozy ported gameplay and reliable saves.

**Architecture:** Pure, deterministic world generation (`(seed, x, y)` → tile) feeds a chunk cache; player changes are stored as per-chunk diffs. Systems (movement, energy, effects, pickups, discovery) mutate state without touching the DOM. The renderer bakes each chunk once to an offscreen canvas and draws it with integer zoom. A fixed-timestep loop drives everything; the DOM HUD and menu sit on top.

**Tech Stack:** Vite 8, TypeScript ~5.9 (strict), Vitest 5, ESLint (flat config) + typescript-eslint, Prettier 3, `simplex-noise` 4. Node 24.

**Spec:** `docs/superpowers/specs/2026-10-18-foundation-design.md`

## Global Constraints

- TypeScript `strict: true`; no `any` in `src/`.
- Generation code (`src/world/**`, `src/core/rng.ts`, `src/core/noise.ts`) never calls `Math.random`.
- Layering: `src/data/` imports nothing from the project. `src/systems/` never touches DOM/canvas. `src/render/` never mutates world or player state.
- Tile = 16 × 16 px (`TILE_PX = 16`); chunk = 32 × 32 tiles (`CHUNK_SIZE = 32`, `CHUNK_PX = 512`).
- Fixed timestep 60 Hz (`TICK_DT = 1/60`), frame delta clamped to 0.25 s, at most 5 ticks per frame.
- Bake budget: at most 2 chunk bakes per frame; baked canvas LRU limit 32; chunk data LRU limit 256.
- Save key `gizmo.save`, `version: 1`; corrupt saves are copied to `gizmo.save.corrupt-<timestamp>`.
- Integer zoom only, `imageSmoothingEnabled = false`, camera draw offset snapped to whole texture pixels.
- No game over. Energy 0 means "tired" (×0.5 speed).
- No Pac-Man sounds in the new game. `legacy/` exists only as a reference while porting; Task 14 deletes it and everything that mentions it.
- The project is MIT-licensed (`LICENSE`, copyright holder: the git user `Jezek Sadrovy`, year 2026).
- Run `npm run format` before every commit. Every commit message ends with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (shown once here, omitted from the commit commands below for brevity; add it).
- Work happens on the `foundation` branch.

## Review Focus

1. **A saved position becomes solid** (the generator changed between versions, or the import came from another build): on load, Gizmo must be moved to the nearest walkable tile, never stuck. Pinned by `unstick` tests in Task 8.
2. **Walking along a biome border** must not spam the biome toast every few frames: a new biome must hold for 0.4 s before it counts. Pinned by discovery tests in Task 9.
3. **A movement key held while the window loses focus** (alt-tab, a dialog) must not leave Gizmo walking forever: keys are cleared on blur. Pinned by the `Keyboard.clear` test in Task 11 and the manual checklist in Task 14.
4. **A huge frame delta** (tab in background, debugger pause, slow phone) must not tunnel Gizmo through walls or freeze the game catching up: clamping the accumulator plus ≤1 px collision substeps. Pinned by the `stepAccumulator` tests in Task 2 and the tunnelling test in Task 8.
5. **Importing a bad, foreign or newer-version save file** must be rejected with a message and leave the current game untouched. Pinned by `parseSave` rejection tests in Task 10 and the import flow in Task 13.

---

## File map

| File | Responsibility |
|---|---|
| `src/config.ts` | Global numeric constants |
| `src/core/rng.ts` | `hashString`, `mulberry32`, `hash2`, `pickWeighted` |
| `src/core/noise.ts` | `makeFractalNoise` (simplex, 0..1, contrast) |
| `src/core/lru.ts` | `LruCache` |
| `src/core/loop.ts` | `stepAccumulator`, `startLoop` |
| `src/core/vec.ts` | `Vec2`, `normalize` |
| `src/data/terrains.ts` | Terrain table |
| `src/data/items.ts` | Item table, effect kinds |
| `src/data/blocks.ts` | Obstacle and brick blocks |
| `src/data/biomes.ts` | 19 biomes: terrains, items, obstacles, effects |
| `src/data/buildings.ts` | Blueprints and char map |
| `src/world/genConfig.ts` | Generation tuning constants |
| `src/world/biomeField.ts` | Climate noise → biome |
| `src/world/chunk.ts` | `ChunkData` and coordinate helpers |
| `src/world/generator.ts` | `WorldGenerator`: pure chunk generation |
| `src/world/World.ts` | Chunk cache, diffs, tile queries, spawn search |
| `src/entities/Player.ts` | Player state |
| `src/systems/effects.ts` | Timed effects |
| `src/systems/energy.ts` | Energy drain/regen, tired |
| `src/systems/movement.ts` | Speed, collision, ice, wobble, unstick |
| `src/systems/pickups.ts` | Item pickup and magnet |
| `src/systems/discovery.ts` | Biome change with hysteresis, discovered set |
| `src/save/storage.ts` | Save schema, validate, migrate, load/write |
| `src/save/fileio.ts` | Export/import save files (DOM) |
| `src/input/keyboard.ts` | Key set → vector |
| `src/input/touchJoystick.ts` | Floating joystick |
| `src/input/Input.ts` | Combined direction |
| `src/render/color.ts` | Hex parsing, shading |
| `src/render/camera.ts` | Zoom choice, camera follow |
| `src/render/sprites.ts` | Code-defined pixel sprites |
| `src/render/chunkBaker.ts` | Chunk → pixels → canvas |
| `src/render/BakeCache.ts` | Budgeted LRU of baked canvases |
| `src/render/Renderer.ts` | Frame drawing |
| `src/ui/hud.ts` | HUD DOM updates, toast, notice |
| `src/ui/menu.ts` | Menu dialog |
| `src/ui/debugOverlay.ts` | Debug text overlay |
| `src/seedWords.ts` | Random readable seeds |
| `src/Game.ts` | Wires world, player, systems, renderer |
| `src/main.ts` | Bootstrap, loop, autosave, events |

---

### Task 1: Move legacy and scaffold the project

**Files:**
- Move: all current root files and `sounds/`, `tools/` → `legacy/`
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `.prettierrc`, `.prettierignore`, `.gitignore`, `index.html`, `src/config.ts`, `src/main.ts`, `tests/smoke.test.ts`

**Interfaces:**
- Produces: `src/config.ts` constants used by every later task (names below are final).

- [ ] **Step 1: Move the legacy prototype**

```bash
mkdir legacy
git mv BiomeMap.js BiomeSprite.js Chunk.js Player.js Tile.js defs-bricks.js defs-buildings.js defs-items.js defs-terrains.js defs.js gizmo.css gizmo.js growing-biomes.html index.html sprites.js terrain.js utils.js sounds tools legacy/
git commit -m "chore: move legacy prototype to legacy/"
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "gizmos-world",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint . && prettier --check .",
    "format": "prettier --write ."
  }
}
```

- [ ] **Step 3: Install dependencies**

```bash
npm install simplex-noise@^4.0.3
npm install -D vite vitest typescript@~5.9.3 eslint @eslint/js typescript-eslint prettier
```

Expected: installs without peer-dependency errors. (typescript-eslint supports TypeScript `<6.1`, which is why TypeScript is pinned to 5.9.)

- [ ] **Step 4: Create config files**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vite/client"]
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base works on GitHub Pages sub-paths and on itch.io.
  base: './',
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

`eslint.config.js`:
```js
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist', 'legacy', 'node_modules', 'coverage']),
  js.configs.recommended,
  tseslint.configs.recommended,
]);
```

`.prettierrc`:
```json
{ "singleQuote": true, "printWidth": 100 }
```

`.prettierignore`:
```
dist
legacy
node_modules
coverage
docs
package-lock.json
```

`.gitignore`:
```
node_modules
dist
coverage
```

`index.html` (placeholder; replaced in Task 13):
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Gizmo's World</title>
  </head>
  <body>
    <canvas id="game"></canvas>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: Write the failing smoke test**

`tests/smoke.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { CHUNK_PX, CHUNK_SIZE, TILE_PX } from '../src/config';

describe('config', () => {
  it('derives chunk pixel size from tile and chunk size', () => {
    expect(TILE_PX).toBe(16);
    expect(CHUNK_SIZE).toBe(32);
    expect(CHUNK_PX).toBe(512);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `../src/config`.

- [ ] **Step 7: Create `src/config.ts` and placeholder `src/main.ts`**

`src/config.ts`:
```ts
export const TILE_PX = 16;
export const CHUNK_SIZE = 32;
export const CHUNK_PX = TILE_PX * CHUNK_SIZE;

export const TICK_DT = 1 / 60;
export const MAX_FRAME_SECONDS = 0.25;
export const MAX_TICKS_PER_FRAME = 5;

/** Base walking speed in world pixels per second (4.5 tiles/s). */
export const BASE_SPEED = 4.5 * TILE_PX;
export const TIRED_SPEED_MULT = 0.5;
export const MAX_ENERGY = 100;
export const MAGNET_RADIUS_TILES = 4;

export const CHUNK_CACHE_LIMIT = 256;
export const BAKED_CACHE_LIMIT = 32;
export const BAKES_PER_FRAME = 2;
export const PREFETCH_GENERATIONS_PER_FRAME = 1;

export const TARGET_TILES_SHORT_SIDE = 14;
export const MIN_ZOOM = 2;
export const CAMERA_STIFFNESS = 8;

export const SAVE_KEY = 'gizmo.save';
export const AUTOSAVE_SECONDS = 10;
```

`src/main.ts`:
```ts
import { CHUNK_PX } from './config';

console.info(`Gizmo's World scaffold (chunk ${CHUNK_PX}px)`);
```

- [ ] **Step 8: Verify tests, lint and build pass**

Run: `npm run format && npm test && npm run lint && npm run build`
Expected: 1 test passes; lint clean; `dist/index.html` produced.

- [ ] **Step 9: Verify the legacy game still runs**

Run: `npx vite --port 5173` and open `http://localhost:5173/legacy/index.html`.
Expected: the old game appears and Gizmo moves with WASD. Stop the server.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + TypeScript + Vitest project"
```

---

### Task 2: Core utilities — RNG, noise, LRU, loop, vectors

**Files:**
- Create: `src/core/rng.ts`, `src/core/noise.ts`, `src/core/lru.ts`, `src/core/loop.ts`, `src/core/vec.ts`
- Test: `tests/core/rng.test.ts`, `tests/core/noise.test.ts`, `tests/core/lru.test.ts`, `tests/core/loop.test.ts`

**Interfaces:**
- Produces:
  - `hashString(text: string): number` (uint32)
  - `mulberry32(seed: number): () => number` ([0,1))
  - `hash2(seed: number, x: number, y: number, salt?: number): number` ([0,1))
  - `pickWeighted<K extends string>(weights: Partial<Record<K, number>>, u: number): K | null`
  - `type Noise2D = (x: number, y: number) => number`; `interface FractalOptions { scale; octaves; persistence?; lacunarity?; contrast? }`; `makeFractalNoise(seed: number, opts: FractalOptions): Noise2D` ([0,1])
  - `class LruCache<K, V>(limit: number, onEvict?: (k, v) => void)` with `get`, `peek`, `has`, `set`, `clear`, `size`
  - `stepAccumulator(acc, frameSeconds, tickSeconds, maxTicks): { ticks: number; accumulator: number }`
  - `startLoop(tickSeconds, maxTicks, update: (dt) => void, render: (frameSeconds) => void): LoopHandle` with `stop()`, `setPaused(p: boolean)`
  - `interface Vec2 { x: number; y: number }`, `normalize(v: Vec2): Vec2`

- [ ] **Step 1: Write the failing tests**

`tests/core/rng.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { hash2, hashString, mulberry32, pickWeighted } from '../../src/core/rng';

describe('hashString', () => {
  it('is deterministic, unsigned and distinguishes inputs', () => {
    expect(hashString('maple-17')).toBe(hashString('maple-17'));
    expect(hashString('a')).not.toBe(hashString('b'));
    expect(Number.isInteger(hashString('x'))).toBe(true);
    expect(hashString('x')).toBeGreaterThanOrEqual(0);
  });
});

describe('mulberry32', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it('returns values in [0, 1)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 10000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('hash2', () => {
  it('is deterministic', () => {
    expect(hash2(1, 5, -7, 3)).toBe(hash2(1, 5, -7, 3));
  });

  it('varies with every argument and is not symmetric in x/y', () => {
    const base = hash2(1, 5, 7, 0);
    expect(hash2(2, 5, 7, 0)).not.toBe(base);
    expect(hash2(1, 6, 7, 0)).not.toBe(base);
    expect(hash2(1, 5, 8, 0)).not.toBe(base);
    expect(hash2(1, 5, 7, 1)).not.toBe(base);
    expect(hash2(1, 7, 5, 0)).not.toBe(base);
  });

  it('is roughly uniform over a grid including negative coordinates', () => {
    let sum = 0;
    let n = 0;
    let min = 1;
    let max = 0;
    for (let y = -50; y < 50; y++) {
      for (let x = -50; x < 50; x++) {
        const v = hash2(99, x, y);
        sum += v;
        n++;
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
    }
    expect(sum / n).toBeGreaterThan(0.48);
    expect(sum / n).toBeLessThan(0.52);
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThan(1);
  });
});

describe('pickWeighted', () => {
  it('maps u across the cumulative weights, skipping zero weights', () => {
    const w = { a: 1, b: 0, c: 3 };
    expect(pickWeighted(w, 0)).toBe('a');
    expect(pickWeighted(w, 0.24)).toBe('a');
    expect(pickWeighted(w, 0.26)).toBe('c');
    expect(pickWeighted(w, 0.9999)).toBe('c');
  });

  it('returns null when nothing has positive weight', () => {
    expect(pickWeighted({ a: 0 }, 0.5)).toBeNull();
    expect(pickWeighted({}, 0.5)).toBeNull();
  });
});
```

`tests/core/noise.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { makeFractalNoise } from '../../src/core/noise';
import { mulberry32 } from '../../src/core/rng';

const opts = { scale: 50, octaves: 3 };

function stdDev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
}

function sample(contrast: number): number[] {
  const n = makeFractalNoise(3, { ...opts, contrast });
  const out: number[] = [];
  for (let y = 0; y < 100; y++) for (let x = 0; x < 100; x++) out.push(n(x * 5, y * 5));
  return out;
}

describe('makeFractalNoise', () => {
  it('is deterministic per seed', () => {
    expect(makeFractalNoise(5, opts)(12.5, -40)).toBe(makeFractalNoise(5, opts)(12.5, -40));
  });

  it('differs between seeds', () => {
    expect(makeFractalNoise(5, opts)(10, 10)).not.toBe(makeFractalNoise(6, opts)(10, 10));
  });

  it('stays within [0, 1] even with high contrast', () => {
    const n = makeFractalNoise(1, { ...opts, contrast: 3 });
    const r = mulberry32(9);
    for (let i = 0; i < 10000; i++) {
      const v = n((r() - 0.5) * 10000, (r() - 0.5) * 10000);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('is continuous', () => {
    const n = makeFractalNoise(1, opts);
    for (let i = 0; i < 100; i++) {
      const x = i * 7.3;
      expect(Math.abs(n(x, 3) - n(x + 0.05, 3))).toBeLessThan(0.05);
    }
  });

  it('contrast widens the distribution', () => {
    expect(stdDev(sample(2))).toBeGreaterThan(stdDev(sample(1)) * 1.5);
  });
});
```

`tests/core/lru.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { LruCache } from '../../src/core/lru';

describe('LruCache', () => {
  it('evicts the least recently used entry and reports it', () => {
    const evicted: string[] = [];
    const c = new LruCache<string, number>(2, (k) => evicted.push(k));
    c.set('a', 1);
    c.set('b', 2);
    c.get('a');
    c.set('c', 3);
    expect(c.peek('b')).toBeUndefined();
    expect(c.get('a')).toBe(1);
    expect(c.get('c')).toBe(3);
    expect(evicted).toEqual(['b']);
    expect(c.size).toBe(2);
  });

  it('replacing an existing key does not evict', () => {
    const evicted: string[] = [];
    const c = new LruCache<string, number>(2, (k) => evicted.push(k));
    c.set('a', 1);
    c.set('b', 2);
    c.set('a', 10);
    expect(evicted).toEqual([]);
    expect(c.get('a')).toBe(10);
  });

  it('peek does not refresh recency', () => {
    const c = new LruCache<string, number>(2);
    c.set('a', 1);
    c.set('b', 2);
    c.peek('a');
    c.set('c', 3);
    expect(c.has('a')).toBe(false);
  });
});
```

`tests/core/loop.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { stepAccumulator } from '../../src/core/loop';

const TICK = 1 / 60;

describe('stepAccumulator', () => {
  it('runs one tick for one 60 Hz frame', () => {
    expect(stepAccumulator(0, TICK, TICK, 5).ticks).toBe(1);
  });

  it('carries leftover time between frames', () => {
    const a = stepAccumulator(0, TICK / 2, TICK, 5);
    expect(a.ticks).toBe(0);
    const b = stepAccumulator(a.accumulator, TICK / 2, TICK, 5);
    expect(b.ticks).toBe(1);
  });

  it('clamps huge frames and drops the backlog beyond maxTicks', () => {
    const r = stepAccumulator(0, 10, TICK, 5);
    expect(r.ticks).toBe(5);
    expect(r.accumulator).toBe(0);
  });

  it('ignores negative frame times', () => {
    const r = stepAccumulator(0, -1, TICK, 5);
    expect(r.ticks).toBe(0);
    expect(r.accumulator).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — modules `src/core/*` not found.

- [ ] **Step 3: Implement the core modules**

`src/core/rng.ts`:
```ts
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
```

`src/core/noise.ts`:
```ts
import { createNoise2D } from 'simplex-noise';
import { mulberry32 } from './rng';

export type Noise2D = (x: number, y: number) => number;

export interface FractalOptions {
  /** Approximate feature size in tiles. */
  scale: number;
  octaves: number;
  persistence?: number;
  lacunarity?: number;
  /** Values > 1 stretch the output away from 0.5 (then clamp). */
  contrast?: number;
}

/** Fractal simplex noise normalised to [0, 1]. */
export function makeFractalNoise(seed: number, opts: FractalOptions): Noise2D {
  const base = createNoise2D(mulberry32(seed));
  const persistence = opts.persistence ?? 0.5;
  const lacunarity = opts.lacunarity ?? 2;
  const contrast = opts.contrast ?? 1;
  let ampSum = 0;
  for (let o = 0, a = 1; o < opts.octaves; o++, a *= persistence) ampSum += a;
  const baseFreq = 1 / opts.scale;

  return (x, y) => {
    let sum = 0;
    let amp = 1;
    let freq = baseFreq;
    for (let o = 0; o < opts.octaves; o++) {
      sum += amp * base(x * freq, y * freq);
      amp *= persistence;
      freq *= lacunarity;
    }
    const v = 0.5 + 0.5 * contrast * (sum / ampSum);
    return v < 0 ? 0 : v > 1 ? 1 : v;
  };
}
```

`src/core/lru.ts`:
```ts
export class LruCache<K, V> {
  private readonly map = new Map<K, V>();

  constructor(
    private readonly limit: number,
    private readonly onEvict?: (key: K, value: V) => void,
  ) {}

  get size(): number {
    return this.map.size;
  }

  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      this.map.delete(key);
      this.map.set(key, value);
    }
    return value;
  }

  peek(key: K): V | undefined {
    return this.map.get(key);
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  set(key: K, value: V): void {
    this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.limit) {
      const oldest = this.map.keys().next().value as K;
      const oldValue = this.map.get(oldest) as V;
      this.map.delete(oldest);
      this.onEvict?.(oldest, oldValue);
    }
  }

  clear(): void {
    this.map.clear();
  }
}
```

`src/core/loop.ts`:
```ts
import { MAX_FRAME_SECONDS } from '../config';

export interface AccumulatorResult {
  ticks: number;
  accumulator: number;
}

/** Fixed-timestep bookkeeping: how many ticks to run for this frame. */
export function stepAccumulator(
  accumulator: number,
  frameSeconds: number,
  tickSeconds: number,
  maxTicks: number,
): AccumulatorResult {
  let acc = accumulator + Math.min(Math.max(frameSeconds, 0), MAX_FRAME_SECONDS);
  let ticks = Math.floor(acc / tickSeconds);
  acc = Math.max(0, acc - ticks * tickSeconds);
  if (ticks > maxTicks) {
    ticks = maxTicks;
    acc = 0;
  }
  return { ticks, accumulator: acc };
}

export interface LoopHandle {
  stop(): void;
  setPaused(paused: boolean): void;
}

export function startLoop(
  tickSeconds: number,
  maxTicks: number,
  update: (dt: number) => void,
  render: (frameSeconds: number) => void,
): LoopHandle {
  let acc = 0;
  let last = performance.now();
  let paused = false;
  let running = true;

  const frame = (now: number) => {
    if (!running) return;
    const frameSeconds = (now - last) / 1000;
    last = now;
    if (!paused) {
      const r = stepAccumulator(acc, frameSeconds, tickSeconds, maxTicks);
      acc = r.accumulator;
      for (let i = 0; i < r.ticks; i++) update(tickSeconds);
    }
    render(frameSeconds);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  return {
    stop: () => {
      running = false;
    },
    setPaused: (p) => {
      paused = p;
      last = performance.now();
      acc = 0;
    },
  };
}
```

`src/core/vec.ts`:
```ts
export interface Vec2 {
  x: number;
  y: number;
}

export const ZERO: Vec2 = Object.freeze({ x: 0, y: 0 });

/** Unit-length copy of v, or zero for a zero vector. */
export function normalize(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.y);
  return len === 0 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all core tests PASS.

- [ ] **Step 5: Commit**

```bash
npm run format && npm run lint
git add src/core tests/core
git commit -m "feat(core): seeded rng, fractal noise, LRU cache, fixed-step loop"
```

---

### Task 3: Content data tables

**Files:**
- Create: `src/data/terrains.ts`, `src/data/items.ts`, `src/data/blocks.ts`, `src/data/biomes.ts`, `src/data/buildings.ts`
- Test: `tests/data/data.test.ts`

**Interfaces:**
- Produces:
  - `TERRAIN_KEYS`, `type TerrainKey`, `interface TerrainDef { key; name; color; speed; solid; slippery }`, `TERRAINS: readonly TerrainDef[]`, `TERRAIN_INDEX: Record<TerrainKey, number>`
  - `ITEM_KEYS`, `type ItemKey`, `EFFECT_KINDS`, `type EffectKind = 'zoom' | 'magnet' | 'sap' | 'wobble'`, `type ItemEffect`, `interface ItemDef { id; key; name; color; treasure; effects }`, `NO_ITEM = 0`, `ITEMS`, `ITEM_ID: Record<ItemKey, number>`, `itemById(id): ItemDef | undefined`
  - `BLOCK_KEYS`, `type BlockKey`, `interface BlockDef { id; key; color; kind: 'obstacle' | 'brick' }`, `NO_BLOCK = 0`, `BLOCKS`, `BLOCK_ID: Record<BlockKey, number>`, `blockById(id): BlockDef | undefined`
  - `BIOME_NAMES`, `type BiomeName`, `type BiomeEffect = 'heal' | 'decay'`, `interface BiomeDef { name; terrains; itemChance; effect?; items; obstacles; solidTerrains?; tint }`, `BIOMES`, `BIOME_INDEX: Record<BiomeName, number>`
  - `BLUEPRINT_CHARS: Record<string, BlockKey | null>`, `interface BuildingDef { name; blueprint; foundIn }`, `BUILDINGS`, `BUILDING_BY_NAME: Record<string, BuildingDef>`

- [ ] **Step 1: Write the failing test**

`tests/data/data.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { CHUNK_SIZE } from '../../src/config';
import { BIOMES, BIOME_INDEX } from '../../src/data/biomes';
import { BLOCKS, BLOCK_ID, NO_BLOCK, blockById } from '../../src/data/blocks';
import { BLUEPRINT_CHARS, BUILDINGS } from '../../src/data/buildings';
import { ITEMS, ITEM_ID, NO_ITEM, itemById } from '../../src/data/items';
import { TERRAINS, TERRAIN_INDEX, type TerrainKey } from '../../src/data/terrains';

describe('biomes', () => {
  it('has all 19 legacy biomes with unique names and a matching index', () => {
    expect(BIOMES).toHaveLength(19);
    expect(new Set(BIOMES.map((b) => b.name)).size).toBe(19);
    BIOMES.forEach((b, i) => expect(BIOME_INDEX[b.name]).toBe(i));
  });

  it('every biome has positive terrain and item weights', () => {
    for (const b of BIOMES) {
      const tw = Object.values(b.terrains) as number[];
      const iw = Object.values(b.items) as number[];
      expect(tw.length, b.name).toBeGreaterThan(0);
      expect(tw.every((w) => w > 0), b.name).toBe(true);
      expect(iw.every((w) => w > 0), b.name).toBe(true);
    }
  });

  it('every biome except Iceberg has walkable terrain', () => {
    for (const b of BIOMES) {
      if (b.name === 'Iceberg') continue;
      const walkable = (Object.keys(b.terrains) as TerrainKey[]).some(
        (k) => !TERRAINS[TERRAIN_INDEX[k]].solid && !b.solidTerrains?.includes(k),
      );
      expect(walkable, b.name).toBe(true);
    }
  });

  it('biome obstacles are obstacle blocks', () => {
    for (const b of BIOMES) {
      for (const key of Object.keys(b.obstacles) as (keyof typeof BLOCK_ID)[]) {
        expect(blockById(BLOCK_ID[key])?.kind, `${b.name}/${key}`).toBe('obstacle');
      }
    }
  });
});

describe('items and blocks', () => {
  it('item ids are 1-based and round-trip; 0 means none', () => {
    expect(itemById(NO_ITEM)).toBeUndefined();
    ITEMS.forEach((it, i) => {
      expect(it.id).toBe(i + 1);
      expect(itemById(it.id)).toBe(it);
      expect(ITEM_ID[it.key]).toBe(it.id);
    });
  });

  it('block ids round-trip; 0 means none', () => {
    expect(blockById(NO_BLOCK)).toBeUndefined();
    BLOCKS.forEach((b) => expect(blockById(b.id)).toBe(b));
  });
});

describe('buildings', () => {
  it('blueprints are rectangular, fit in a chunk and use known characters', () => {
    for (const b of BUILDINGS) {
      const w = b.blueprint[0].length;
      expect(w).toBeLessThanOrEqual(CHUNK_SIZE);
      expect(b.blueprint.length).toBeLessThanOrEqual(CHUNK_SIZE);
      for (const row of b.blueprint) {
        expect(row.length, b.name).toBe(w);
        for (const ch of row) {
          expect(ch === ' ' || ch in BLUEPRINT_CHARS, `${b.name} '${ch}'`).toBe(true);
        }
      }
    }
  });

  it('blueprint characters map to brick blocks', () => {
    for (const key of Object.values(BLUEPRINT_CHARS)) {
      if (key === null) continue;
      expect(blockById(BLOCK_ID[key])?.kind, key).toBe('brick');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/data`
Expected: FAIL — modules not found.

- [ ] **Step 3: Create the data tables**

`src/data/terrains.ts`:
```ts
export const TERRAIN_KEYS = [
  'grass',
  'dirt',
  'snow',
  'water',
  'lava',
  'sand',
  'stone',
  'mud',
  'ice',
  'swamp',
  'rock',
  'snowy_dirt',
  'grassland',
  'forest_floor',
  'volcanic_rock',
  'bog',
] as const;

export type TerrainKey = (typeof TERRAIN_KEYS)[number];

export interface TerrainDef {
  key: TerrainKey;
  name: string;
  color: string;
  /** Movement speed multiplier. */
  speed: number;
  /** Impassable everywhere (water, lava). */
  solid: boolean;
  /** Ice-like momentum. */
  slippery: boolean;
}

const DEFS: Record<TerrainKey, Omit<TerrainDef, 'key'>> = {
  grass: { name: 'Grass', color: '#4fa836', speed: 1, solid: false, slippery: false },
  dirt: { name: 'Dirt', color: '#8b5a2b', speed: 1, solid: false, slippery: false },
  snow: { name: 'Snow', color: '#eef4f4', speed: 0.85, solid: false, slippery: false },
  water: { name: 'Water', color: '#2f7fe0', speed: 1, solid: true, slippery: false },
  lava: { name: 'Lava', color: '#e2582c', speed: 1, solid: true, slippery: false },
  sand: { name: 'Sand', color: '#f2dc9b', speed: 0.85, solid: false, slippery: false },
  stone: { name: 'Stone', color: '#7d7d7d', speed: 1, solid: false, slippery: false },
  mud: { name: 'Mud', color: '#6b4a26', speed: 0.7, solid: false, slippery: false },
  ice: { name: 'Ice', color: '#bfe3f7', speed: 1.1, solid: false, slippery: true },
  swamp: { name: 'Swamp', color: '#2f7a3a', speed: 0.7, solid: false, slippery: false },
  rock: { name: 'Rock', color: '#5c5c5c', speed: 1, solid: false, slippery: false },
  snowy_dirt: { name: 'Snowy dirt', color: '#c9c3bb', speed: 1, solid: false, slippery: false },
  grassland: { name: 'Grassland', color: '#8fd65a', speed: 1, solid: false, slippery: false },
  forest_floor: {
    name: 'Forest floor',
    color: '#4a5a2c',
    speed: 1,
    solid: false,
    slippery: false,
  },
  volcanic_rock: {
    name: 'Volcanic rock',
    color: '#4a3a2a',
    speed: 1,
    solid: false,
    slippery: false,
  },
  bog: { name: 'Bog', color: '#5a4a2c', speed: 0.7, solid: false, slippery: false },
};

export const TERRAINS: readonly TerrainDef[] = TERRAIN_KEYS.map((key) => ({ key, ...DEFS[key] }));

export const TERRAIN_INDEX = Object.fromEntries(TERRAIN_KEYS.map((k, i) => [k, i])) as Record<
  TerrainKey,
  number
>;
```

`src/data/items.ts`:
```ts
export const ITEM_KEYS = ['berry', 'golden', 'zoom', 'sour', 'magnet', 'sap'] as const;
export type ItemKey = (typeof ITEM_KEYS)[number];

export const EFFECT_KINDS = ['zoom', 'magnet', 'sap', 'wobble'] as const;
export type EffectKind = (typeof EFFECT_KINDS)[number];

export type ItemEffect =
  | { kind: 'energy'; amount: number }
  | { kind: 'energyFull' }
  | { kind: 'timed'; effect: EffectKind; duration: number };

export interface ItemDef {
  id: number;
  key: ItemKey;
  name: string;
  color: string;
  treasure: number;
  effects: readonly ItemEffect[];
}

/** Value stored in chunk item arrays for "no item". Item ids start at 1. */
export const NO_ITEM = 0;

export const ITEMS: readonly ItemDef[] = [
  {
    id: 1,
    key: 'berry',
    name: 'Berry',
    color: '#e5484d',
    treasure: 1,
    effects: [{ kind: 'energy', amount: 15 }],
  },
  {
    id: 2,
    key: 'golden',
    name: 'Golden fruit',
    color: '#f5b82e',
    treasure: 5,
    effects: [{ kind: 'energyFull' }],
  },
  {
    id: 3,
    key: 'zoom',
    name: 'Zoom leaf',
    color: '#3fd0c9',
    treasure: 2,
    effects: [{ kind: 'timed', effect: 'zoom', duration: 10 }],
  },
  {
    id: 4,
    key: 'sour',
    name: 'Sour berry',
    color: '#9bd13b',
    treasure: 0,
    effects: [
      { kind: 'energy', amount: -10 },
      { kind: 'timed', effect: 'wobble', duration: 1.5 },
    ],
  },
  {
    id: 5,
    key: 'magnet',
    name: 'Magnet petal',
    color: '#b46ee8',
    treasure: 3,
    effects: [{ kind: 'timed', effect: 'magnet', duration: 15 }],
  },
  {
    id: 6,
    key: 'sap',
    name: 'Sap',
    color: '#d98a1c',
    treasure: 0,
    effects: [{ kind: 'timed', effect: 'sap', duration: 6 }],
  },
];

export const ITEM_ID = Object.fromEntries(ITEMS.map((it) => [it.key, it.id])) as Record<
  ItemKey,
  number
>;

export function itemById(id: number): ItemDef | undefined {
  return id === NO_ITEM ? undefined : ITEMS[id - 1];
}
```

`src/data/blocks.ts`:
```ts
export const BLOCK_KEYS = [
  'boulder',
  'tree',
  'cactus',
  'wall',
  'chest',
  'well',
  'brick_wall',
  'pillar',
  'crate',
  'fence',
  'barrel',
  'statue',
  'tower',
] as const;

export type BlockKey = (typeof BLOCK_KEYS)[number];

export interface BlockDef {
  id: number;
  key: BlockKey;
  color: string;
  /** Obstacles are scattered by the generator; bricks come from building blueprints. */
  kind: 'obstacle' | 'brick';
}

export const NO_BLOCK = 0;

const DEFS: Record<BlockKey, Pick<BlockDef, 'color' | 'kind'>> = {
  boulder: { color: '#8a8580', kind: 'obstacle' },
  tree: { color: '#2d6a2f', kind: 'obstacle' },
  cactus: { color: '#4f9a3c', kind: 'obstacle' },
  wall: { color: '#4b4b55', kind: 'brick' },
  chest: { color: '#a5622a', kind: 'brick' },
  well: { color: '#55588a', kind: 'brick' },
  brick_wall: { color: '#b2442f', kind: 'brick' },
  pillar: { color: '#9a9a9a', kind: 'brick' },
  crate: { color: '#9a6b3f', kind: 'brick' },
  fence: { color: '#7a6a3a', kind: 'brick' },
  barrel: { color: '#6e4420', kind: 'brick' },
  statue: { color: '#b8b8b8', kind: 'brick' },
  tower: { color: '#777777', kind: 'brick' },
};

export const BLOCKS: readonly BlockDef[] = BLOCK_KEYS.map((key, i) => ({
  id: i + 1,
  key,
  ...DEFS[key],
}));

export const BLOCK_ID = Object.fromEntries(BLOCKS.map((b) => [b.key, b.id])) as Record<
  BlockKey,
  number
>;

export function blockById(id: number): BlockDef | undefined {
  return id === NO_BLOCK ? undefined : BLOCKS[id - 1];
}
```

`src/data/biomes.ts` (terrain weights, item chance and effects ported from `legacy/defs.js`; item weights ported from `BIOME_ITEM_PROBS` with red→berry, cyan→zoom, orange→golden, poison→sour, ultra→magnet, sticky→sap and zero weights dropped):
```ts
import type { BlockKey } from './blocks';
import type { ItemKey } from './items';
import type { TerrainKey } from './terrains';

export const BIOME_NAMES = [
  'Forest',
  'Desert',
  'Tundra',
  'Volcano',
  'Swamp',
  'Grassland',
  'Mountains',
  'Snowfield',
  'Iceberg',
  'Beach',
  'Jungle',
  'Marsh',
  'Canyon',
  'Badlands',
  'Ruins',
  'Volcanic Plains',
  'Swamp Forest',
  'Frozen Lake',
  'Savanna',
] as const;

export type BiomeName = (typeof BIOME_NAMES)[number];
export type BiomeEffect = 'heal' | 'decay';

export interface BiomeDef {
  name: BiomeName;
  terrains: Partial<Record<TerrainKey, number>>;
  itemChance: number;
  effect?: BiomeEffect;
  items: Partial<Record<ItemKey, number>>;
  obstacles: Partial<Record<BlockKey, number>>;
  /** Terrains that are impassable only in this biome. */
  solidTerrains?: readonly TerrainKey[];
  /** Debug-overlay tint. */
  tint: string;
}

const DEFS: Record<BiomeName, Omit<BiomeDef, 'name'>> = {
  Forest: {
    terrains: { forest_floor: 0.6, grass: 0.2, mud: 0.2 },
    itemChance: 0.3,
    items: { berry: 5, zoom: 3, golden: 1, sour: 1 },
    obstacles: { tree: 3, boulder: 1 },
    tint: '#2e7d32',
  },
  Desert: {
    terrains: { sand: 0.7, dirt: 0.2, rock: 0.1 },
    itemChance: 0.1,
    items: { berry: 2, zoom: 1, golden: 1, sour: 2, magnet: 0.5 },
    obstacles: { cactus: 3, boulder: 1 },
    tint: '#e9c46a',
  },
  Tundra: {
    terrains: { snow: 0.5, ice: 0.3, stone: 0.2 },
    itemChance: 0.2,
    items: { berry: 3, zoom: 1, golden: 1, sour: 1, magnet: 0.2, sap: 0.5 },
    obstacles: { boulder: 1 },
    tint: '#9fb7c9',
  },
  Volcano: {
    terrains: { lava: 0.4, volcanic_rock: 0.4, dirt: 0.2 },
    itemChance: 0.1,
    effect: 'decay',
    items: { berry: 1, zoom: 1, golden: 2, sour: 2, magnet: 0.5 },
    obstacles: { boulder: 1 },
    tint: '#b23a2b',
  },
  Swamp: {
    terrains: { swamp: 0.5, water: 0.3, bog: 0.2 },
    itemChance: 0.4,
    effect: 'decay',
    items: { berry: 4, zoom: 2, golden: 1, sour: 3, sap: 1 },
    obstacles: { tree: 1 },
    tint: '#386641',
  },
  Grassland: {
    terrains: { grassland: 0.7, grass: 0.2, dirt: 0.1 },
    itemChance: 0.6,
    effect: 'heal',
    items: { berry: 5, zoom: 3, golden: 1, sour: 1, magnet: 0.2, sap: 0.2 },
    obstacles: { tree: 1, boulder: 1 },
    tint: '#8fd65a',
  },
  Mountains: {
    terrains: { stone: 0.5, rock: 0.3, snow: 0.2 },
    itemChance: 0.2,
    items: { berry: 2, zoom: 1, golden: 0.5, sour: 1, magnet: 0.1 },
    obstacles: { boulder: 3 },
    tint: '#8d8d8d',
  },
  Snowfield: {
    terrains: { snow: 0.8, snowy_dirt: 0.2 },
    itemChance: 0.3,
    items: { berry: 3, zoom: 1, golden: 0.5, sour: 1 },
    obstacles: { boulder: 1 },
    tint: '#f1f5f9',
  },
  Iceberg: {
    terrains: { ice: 0.9, water: 0.1 },
    itemChance: 0.2,
    items: { berry: 1, zoom: 1, golden: 0.2, sour: 0.5 },
    obstacles: {},
    solidTerrains: ['ice'],
    tint: '#a5d8ff',
  },
  Beach: {
    terrains: { sand: 0.6, water: 0.3, dirt: 0.1 },
    itemChance: 0.6,
    effect: 'heal',
    items: { berry: 3, zoom: 2, golden: 1, sour: 0.5 },
    obstacles: { boulder: 1 },
    tint: '#ffe8a3',
  },
  Jungle: {
    terrains: { grass: 0.5, forest_floor: 0.3, swamp: 0.2 },
    itemChance: 0.8,
    items: { berry: 6, zoom: 4, golden: 1, sour: 2, magnet: 0.5, sap: 0.5 },
    obstacles: { tree: 4 },
    tint: '#1b9e4b',
  },
  Marsh: {
    terrains: { mud: 0.5, swamp: 0.3, water: 0.2 },
    itemChance: 0.6,
    items: { berry: 4, zoom: 3, golden: 1, sour: 2, sap: 1 },
    obstacles: { tree: 1 },
    tint: '#6a994e',
  },
  Canyon: {
    terrains: { dirt: 0.4, stone: 0.4, sand: 0.2 },
    itemChance: 0.2,
    items: { berry: 2, zoom: 1, golden: 0.5, sour: 1 },
    obstacles: { boulder: 2 },
    tint: '#c7743a',
  },
  Badlands: {
    terrains: { rock: 0.5, dirt: 0.3, sand: 0.2 },
    itemChance: 0.1,
    effect: 'decay',
    items: { berry: 2, zoom: 0.5, golden: 0.5, sour: 1 },
    obstacles: { boulder: 2, cactus: 1 },
    tint: '#a0522d',
  },
  Ruins: {
    terrains: { stone: 0.6, dirt: 0.2, grass: 0.2 },
    itemChance: 0.3,
    effect: 'decay',
    items: { berry: 4, zoom: 2, golden: 2, sour: 3 },
    obstacles: { boulder: 2 },
    tint: '#7e6c5a',
  },
  'Volcanic Plains': {
    terrains: { lava: 0.3, volcanic_rock: 0.5, grass: 0.2 },
    itemChance: 0.3,
    effect: 'decay',
    items: { berry: 1, zoom: 1, golden: 3, sour: 2, magnet: 1 },
    obstacles: { boulder: 1 },
    tint: '#7f2f1f',
  },
  'Swamp Forest': {
    terrains: { swamp: 0.4, forest_floor: 0.4, mud: 0.2 },
    itemChance: 0.7,
    items: { berry: 5, zoom: 3, golden: 1, sour: 3, sap: 1 },
    obstacles: { tree: 3 },
    tint: '#264d32',
  },
  'Frozen Lake': {
    terrains: { ice: 0.7, water: 0.3 },
    itemChance: 0.2,
    items: { berry: 1, zoom: 1, golden: 0.5, sour: 0.5 },
    obstacles: {},
    tint: '#7fb8e0',
  },
  Savanna: {
    terrains: { grassland: 0.6, dirt: 0.3, rock: 0.1 },
    itemChance: 0.7,
    items: { berry: 4, zoom: 2, golden: 1, sour: 1 },
    obstacles: { tree: 1, boulder: 1 },
    tint: '#d4b25c',
  },
};

export const BIOMES: readonly BiomeDef[] = BIOME_NAMES.map((name) => ({ name, ...DEFS[name] }));

export const BIOME_INDEX = Object.fromEntries(BIOME_NAMES.map((n, i) => [n, i])) as Record<
  BiomeName,
  number
>;
```

`src/data/buildings.ts` (blueprints ported from `legacy/defs-buildings.js`; `'O'` was unmapped in legacy and now maps to `tower`):
```ts
import type { BiomeName } from './biomes';
import type { BlockKey } from './blocks';

/**
 * Blueprint characters. null ('.') = clear the tile (no block, no item).
 * A space ' ' leaves the generated tile unchanged.
 */
export const BLUEPRINT_CHARS: Record<string, BlockKey | null> = {
  '#': 'wall',
  '%': 'chest',
  '@': 'well',
  $: 'brick_wall',
  '&': 'pillar',
  '*': 'crate',
  '+': 'fence',
  o: 'barrel',
  '^': 'statue',
  O: 'tower',
  '.': null,
};

export interface BuildingDef {
  name: string;
  blueprint: readonly string[];
  foundIn: Partial<Record<BiomeName, number>>;
}

export const BUILDINGS: readonly BuildingDef[] = [
  {
    name: 'small_house',
    blueprint: ['###', '#.#', '###'],
    foundIn: { Forest: 0.6, Grassland: 1, Beach: 0.4, Savanna: 0.5, Swamp: 0.1, Desert: 0.1 },
  },
  {
    name: 'tavern',
    blueprint: ['$$$$$', '$...$', '$...$', '$$$$$'],
    foundIn: { Forest: 0.4, Grassland: 0.6, Beach: 0.5 },
  },
  {
    name: 'shrine',
    blueprint: ['..@..', '.@@@.', '@@@@@', '@+ +@', '@@@@@', '.@@@.', '..@..'],
    foundIn: { Forest: 0.3, Grassland: 0.5, Beach: 0.4, Mountains: 0.7, Ruins: 0.9 },
  },
  {
    name: 'watch_tower',
    blueprint: ['&&&', '&.&', '&&&', '.&.', '.&.'],
    foundIn: { Forest: 0.5, Grassland: 0.3, Beach: 0.2, Desert: 0.8, Savanna: 0.5 },
  },
  {
    name: 'barn',
    blueprint: ['*******', '*.....*', '*.....*', '*.....*', '*******'],
    foundIn: { Savanna: 1 },
  },
  {
    name: 'blacksmith',
    blueprint: ['%%%%', '%..%', '%..%', '%..%', '%%%%'],
    foundIn: { Forest: 0.1 },
  },
  {
    name: 'mill',
    blueprint: ['OOOOO', 'O...O', 'O*.*O', 'O...O', 'OOOOO'],
    foundIn: { Grassland: 0.1 },
  },
  {
    name: 'temple',
    blueprint: [
      '...***...',
      '..*...*..',
      '.*.....*.',
      '*.......*',
      '*.......*',
      '*.......*',
      '.*.....*.',
      '..*...*..',
      '...***...',
    ],
    foundIn: { Desert: 0.1, Ruins: 0.1 },
  },
];

export const BUILDING_BY_NAME: Record<string, BuildingDef> = Object.fromEntries(
  BUILDINGS.map((b) => [b.name, b]),
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/data`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run format && npm run lint
git add src/data tests/data
git commit -m "feat(data): typed terrain, item, block, biome and building tables"
```

---

### Task 4: Biome field (climate → biome)

**Files:**
- Create: `src/world/genConfig.ts`, `src/world/biomeField.ts`
- Test: `tests/world/biomeField.test.ts`

**Interfaces:**
- Consumes: `makeFractalNoise`, `Noise2D` (Task 2); `BIOME_INDEX`, `BIOMES`, `BiomeName` (Task 3).
- Produces:
  - `GEN_CONFIG` (shape below; Task 5 reads `itemDensity`, `obstacle`, `building`, `terrainDetail`)
  - `interface Climate { elevation; temperature; moisture; landmark }` (all 0..1)
  - `classifyBiomeName(c: Climate): BiomeName`, `classifyBiome(c: Climate): number`
  - `class BiomeField(seed: number)` with `climateAt(tx, ty): Climate` and `biomeAt(tx, ty): number`

- [ ] **Step 1: Write the failing test**

`tests/world/biomeField.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { hashString } from '../../src/core/rng';
import { BIOMES, BIOME_NAMES, type BiomeName } from '../../src/data/biomes';
import { BiomeField, classifyBiomeName, type Climate } from '../../src/world/biomeField';

const c = (elevation: number, temperature: number, moisture: number, landmark = 0): Climate => ({
  elevation,
  temperature,
  moisture,
  landmark,
});

describe('classifyBiomeName', () => {
  const cases: Array<[Climate, BiomeName]> = [
    [c(0.5, 0.2, 0.1), 'Tundra'],
    [c(0.5, 0.2, 0.4), 'Snowfield'],
    [c(0.5, 0.2, 0.6), 'Frozen Lake'],
    [c(0.5, 0.2, 0.9), 'Frozen Lake'],
    [c(0.5, 0.5, 0.1), 'Grassland'],
    [c(0.5, 0.5, 0.4), 'Forest'],
    [c(0.5, 0.5, 0.6), 'Marsh'],
    [c(0.5, 0.5, 0.8), 'Swamp'],
    [c(0.5, 0.8, 0.1), 'Desert'],
    [c(0.5, 0.8, 0.4), 'Savanna'],
    [c(0.5, 0.8, 0.6), 'Jungle'],
    [c(0.5, 0.8, 0.8), 'Swamp Forest'],
    [c(0.1, 0.2, 0.5), 'Iceberg'],
    [c(0.1, 0.5, 0.5), 'Beach'],
    [c(0.8, 0.5, 0.5), 'Mountains'],
    [c(0.8, 0.2, 0.5), 'Mountains'],
    [c(0.9, 0.8, 0.5), 'Volcano'],
    [c(0.85, 0.8, 0.5), 'Volcanic Plains'],
    [c(0.78, 0.8, 0.1), 'Badlands'],
    [c(0.78, 0.8, 0.5), 'Canyon'],
    [c(0.5, 0.5, 0.4, 0.9), 'Ruins'],
    [c(0.5, 0.8, 0.4, 0.9), 'Savanna'],
    // Band boundaries: 0.35 and 0.65 belong to the warmer band.
    [c(0.5, 0.35, 0.4), 'Forest'],
    [c(0.5, 0.65, 0.4), 'Savanna'],
  ];

  it.each(cases)('%o -> %s', (climate, expected) => {
    expect(classifyBiomeName(climate)).toBe(expected);
  });
});

describe('BiomeField', () => {
  it('is deterministic for a seed', () => {
    const a = new BiomeField(42);
    const b = new BiomeField(42);
    for (let i = 0; i < 50; i++) expect(a.biomeAt(i * 37, -i * 53)).toBe(b.biomeAt(i * 37, -i * 53));
  });

  it('produces climate values in [0, 1]', () => {
    const f = new BiomeField(7);
    for (let i = 0; i < 200; i++) {
      const cl = f.climateAt(i * 101 - 5000, i * 67 - 3000);
      for (const v of Object.values(cl)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('produces all 19 biomes within a 2048 x 2048 tile area', () => {
    const f = new BiomeField(hashString('coverage'));
    const counts = new Map<string, number>();
    for (let ty = -1024; ty < 1024; ty += 4) {
      for (let tx = -1024; tx < 1024; tx += 4) {
        const name = BIOMES[f.biomeAt(tx, ty)].name;
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
    const missing = BIOME_NAMES.filter((n) => !counts.has(n));
    expect(missing, `histogram: ${JSON.stringify(Object.fromEntries(counts))}`).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/world/biomeField.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`src/world/genConfig.ts`:
```ts
/** Generation tuning. Change values here only; tune with the debug overlay (?debug). */
export const GEN_CONFIG = {
  warp: { scale: 120, octaves: 2, amplitude: 20 },
  elevation: { scale: 150, octaves: 4 },
  temperature: { scale: 300, octaves: 3 },
  moisture: { scale: 200, octaves: 3 },
  landmark: { scale: 60, octaves: 2 },
  /** Stretches climate noise so extreme bands (peaks, lowlands) actually occur. */
  contrast: 2.0,
  temp: { cold: 0.35, hot: 0.65 },
  moist: { dry: 0.3, medium: 0.5, wet: 0.7 },
  elev: { low: 0.2, high: 0.75, foothills: 0.82, volcano: 0.88 },
  ruins: 0.85,
  /** Multiplies biome.itemChance to get the per-tile item probability. */
  itemDensity: 0.06,
  obstacle: { chance: 0.04, minSpacing: 2 },
  building: { attempts: 2, chance: 0.35 },
  terrainDetail: { minScale: 4, maxScale: 12, octaves: 2 },
} as const;
```

`src/world/biomeField.ts`:
```ts
import { makeFractalNoise, type Noise2D } from '../core/noise';
import { BIOME_INDEX, type BiomeName } from '../data/biomes';
import { GEN_CONFIG } from './genConfig';

export interface Climate {
  elevation: number;
  temperature: number;
  moisture: number;
  landmark: number;
}

type Band = 'cold' | 'temperate' | 'hot';

const TABLE: Record<Band, readonly BiomeName[]> = {
  cold: ['Tundra', 'Snowfield', 'Frozen Lake', 'Frozen Lake'],
  temperate: ['Grassland', 'Forest', 'Marsh', 'Swamp'],
  hot: ['Desert', 'Savanna', 'Jungle', 'Swamp Forest'],
};

export function classifyBiomeName(c: Climate): BiomeName {
  const g = GEN_CONFIG;
  const band: Band =
    c.temperature < g.temp.cold ? 'cold' : c.temperature < g.temp.hot ? 'temperate' : 'hot';
  const moist =
    c.moisture < g.moist.dry ? 0 : c.moisture < g.moist.medium ? 1 : c.moisture < g.moist.wet ? 2 : 3;

  if (c.elevation < g.elev.low) return band === 'cold' ? 'Iceberg' : 'Beach';
  if (c.elevation > g.elev.high) {
    if (band !== 'hot') return 'Mountains';
    if (c.elevation > g.elev.volcano) return 'Volcano';
    if (c.elevation > g.elev.foothills) return 'Volcanic Plains';
    return moist === 0 ? 'Badlands' : 'Canyon';
  }
  if (band === 'temperate' && c.landmark > g.ruins) return 'Ruins';
  return TABLE[band][moist];
}

export function classifyBiome(c: Climate): number {
  return BIOME_INDEX[classifyBiomeName(c)];
}

/** Seamless climate fields sampled in world tile coordinates. */
export class BiomeField {
  private readonly warpX: Noise2D;
  private readonly warpY: Noise2D;
  private readonly elevation: Noise2D;
  private readonly temperature: Noise2D;
  private readonly moisture: Noise2D;
  private readonly landmark: Noise2D;

  constructor(seed: number) {
    const g = GEN_CONFIG;
    const contrast = g.contrast;
    this.warpX = makeFractalNoise(seed + 11, g.warp);
    this.warpY = makeFractalNoise(seed + 12, g.warp);
    this.elevation = makeFractalNoise(seed + 21, { ...g.elevation, contrast });
    this.temperature = makeFractalNoise(seed + 22, { ...g.temperature, contrast });
    this.moisture = makeFractalNoise(seed + 23, { ...g.moisture, contrast });
    this.landmark = makeFractalNoise(seed + 24, { ...g.landmark, contrast });
  }

  climateAt(tx: number, ty: number): Climate {
    const a = GEN_CONFIG.warp.amplitude;
    const x = tx + (this.warpX(tx, ty) * 2 - 1) * a;
    const y = ty + (this.warpY(tx, ty) * 2 - 1) * a;
    return {
      elevation: this.elevation(x, y),
      temperature: this.temperature(x, y),
      moisture: this.moisture(x, y),
      landmark: this.landmark(x, y),
    };
  }

  biomeAt(tx: number, ty: number): number {
    return classifyBiome(this.climateAt(tx, ty));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/world/biomeField.test.ts`
Expected: PASS.

If only the coverage test fails, the assertion message prints a biome histogram. Tune `GEN_CONFIG` and re-run, in this order: raise `contrast` in steps of 0.2 (up to 2.6) if extreme biomes (Volcano, Iceberg, Badlands) are missing; lower `ruins` towards 0.8 if Ruins is missing; widen the specific `elev` band otherwise. Do not change the classification table or the test. Note the final values in the commit message.

- [ ] **Step 5: Commit**

```bash
npm run format && npm run lint
git add src/world tests/world
git commit -m "feat(world): climate noise fields and biome classification"
```

---

### Task 5: Chunk data and the world generator

**Files:**
- Create: `src/world/chunk.ts`, `src/world/generator.ts`
- Test: `tests/world/generator.test.ts`

**Interfaces:**
- Consumes: `hash2`, `pickWeighted`, `makeFractalNoise` (Task 2); data tables (Task 3); `BiomeField`, `GEN_CONFIG` (Task 4).
- Produces:
  - `interface ChunkData { cx; cy; terrain; biome; item; block; solid }` (`Uint8Array(1024)` each, index `ly * 32 + lx`)
  - `createChunkData(cx, cy): ChunkData`, `localIndex(lx, ly)`, `chunkKey(cx, cy): string` (`"cx,cy"`), `tileToChunk(t)`, `tileToLocal(t)`
  - `SALT` constants: `{ item: 1, itemType: 2, obstacle: 3, obstacleType: 4, shade: 5, building: 100 }`
  - `class WorldGenerator(seed: number)` with `readonly seed`, `readonly field: BiomeField`, `sampleTile(tx, ty): { biome: number; terrain: number }`, `isTerrainSolid(biome, terrain): boolean`, `generateChunk(cx, cy): ChunkData`

- [ ] **Step 1: Write the failing test**

`tests/world/generator.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { CHUNK_SIZE } from '../../src/config';
import { NO_BLOCK, blockById } from '../../src/data/blocks';
import { NO_ITEM } from '../../src/data/items';
import { localIndex, tileToChunk, tileToLocal } from '../../src/world/chunk';
import { WorldGenerator } from '../../src/world/generator';

const SEED = 123456;
const LAYERS = ['terrain', 'biome', 'item', 'block', 'solid'] as const;

describe('chunk helpers', () => {
  it('maps negative tiles to the right chunk and local index', () => {
    expect(tileToChunk(-1)).toBe(-1);
    expect(tileToLocal(-1)).toBe(31);
    expect(tileToChunk(-32)).toBe(-1);
    expect(tileToLocal(-32)).toBe(0);
    expect(tileToChunk(-33)).toBe(-2);
    expect(tileToChunk(32)).toBe(1);
    expect(tileToLocal(32)).toBe(0);
    expect(localIndex(3, 2)).toBe(2 * CHUNK_SIZE + 3);
  });
});

describe('WorldGenerator', () => {
  it('produces identical chunks for the same seed regardless of generation order', () => {
    const a = new WorldGenerator(SEED);
    const b = new WorldGenerator(SEED);
    const a11 = a.generateChunk(1, 1);
    const a00 = a.generateChunk(0, 0);
    const b00 = b.generateChunk(0, 0);
    const b11 = b.generateChunk(1, 1);
    for (const layer of LAYERS) {
      expect(a00[layer]).toEqual(b00[layer]);
      expect(a11[layer]).toEqual(b11[layer]);
    }
  });

  it('differs between seeds', () => {
    const a = new WorldGenerator(1).generateChunk(0, 0);
    const b = new WorldGenerator(2).generateChunk(0, 0);
    expect(a.terrain).not.toEqual(b.terrain);
  });

  it('matches direct per-tile sampling across chunk borders, including negative chunks', () => {
    const g = new WorldGenerator(SEED);
    let mismatches = 0;
    for (let cy = -1; cy <= 0; cy++) {
      for (let cx = -1; cx <= 0; cx++) {
        const chunk = g.generateChunk(cx, cy);
        for (let ly = 0; ly < CHUNK_SIZE; ly++) {
          for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            const s = g.sampleTile(cx * CHUNK_SIZE + lx, cy * CHUNK_SIZE + ly);
            const i = localIndex(lx, ly);
            if (chunk.biome[i] !== s.biome || chunk.terrain[i] !== s.terrain) mismatches++;
          }
        }
      }
    }
    expect(mismatches).toBe(0);
  });

  it('never places obstacles next to each other, even across chunk borders', () => {
    const g = new WorldGenerator(SEED);
    const size = 3 * CHUNK_SIZE;
    const grid = new Uint8Array(size * size);
    for (let cy = 0; cy < 3; cy++) {
      for (let cx = 0; cx < 3; cx++) {
        const chunk = g.generateChunk(cx, cy);
        for (let ly = 0; ly < CHUNK_SIZE; ly++) {
          for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            if (blockById(chunk.block[localIndex(lx, ly)])?.kind === 'obstacle') {
              grid[(cy * CHUNK_SIZE + ly) * size + cx * CHUNK_SIZE + lx] = 1;
            }
          }
        }
      }
    }
    let adjacent = 0;
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        if (!grid[y * size + x]) continue;
        if (grid[y * size + x + 1] || grid[(y + 1) * size + x] || grid[(y + 1) * size + x + 1])
          adjacent++;
        if (x > 0 && grid[(y + 1) * size + x - 1]) adjacent++;
      }
    }
    expect(adjacent).toBe(0);
  });

  it('marks blocks solid and keeps items off solid tiles', () => {
    const g = new WorldGenerator(SEED);
    let violations = 0;
    for (let cy = -1; cy <= 1; cy++) {
      for (let cx = -1; cx <= 1; cx++) {
        const chunk = g.generateChunk(cx, cy);
        for (let i = 0; i < CHUNK_SIZE * CHUNK_SIZE; i++) {
          if (chunk.block[i] !== NO_BLOCK && chunk.solid[i] !== 1) violations++;
          if (chunk.solid[i] === 1 && chunk.item[i] !== NO_ITEM) violations++;
        }
      }
    }
    expect(violations).toBe(0);
  });

  it('places buildings somewhere in a 12 x 12 chunk area', () => {
    const g = new WorldGenerator(SEED);
    let found = false;
    for (let cy = -6; cy < 6 && !found; cy++) {
      for (let cx = -6; cx < 6 && !found; cx++) {
        found = g.generateChunk(cx, cy).block.some((b) => blockById(b)?.kind === 'brick');
      }
    }
    expect(found).toBe(true);
  });

  it('places items at a sensible density', () => {
    const g = new WorldGenerator(SEED);
    let items = 0;
    let tiles = 0;
    for (let cy = 0; cy < 4; cy++) {
      for (let cx = 0; cx < 4; cx++) {
        const chunk = g.generateChunk(cx, cy);
        items += chunk.item.filter((v) => v !== NO_ITEM).length;
        tiles += chunk.item.length;
      }
    }
    expect(items / tiles).toBeGreaterThan(0.002);
    expect(items / tiles).toBeLessThan(0.08);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/world/generator.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`src/world/chunk.ts`:
```ts
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
```

`src/world/generator.ts`:
```ts
import { CHUNK_SIZE } from '../config';
import { makeFractalNoise, type Noise2D } from '../core/noise';
import { hash2, pickWeighted } from '../core/rng';
import { BIOMES } from '../data/biomes';
import { BLOCK_ID, NO_BLOCK } from '../data/blocks';
import { BLUEPRINT_CHARS, BUILDINGS, BUILDING_BY_NAME, type BuildingDef } from '../data/buildings';
import { ITEM_ID, NO_ITEM } from '../data/items';
import { TERRAINS, TERRAIN_INDEX, type TerrainKey } from '../data/terrains';
import { BiomeField } from './biomeField';
import { createChunkData, localIndex, type ChunkData } from './chunk';
import { GEN_CONFIG } from './genConfig';

/** Hash salts so independent decisions on the same tile don't correlate. */
export const SALT = {
  item: 1,
  itemType: 2,
  obstacle: 3,
  obstacleType: 4,
  shade: 5,
  building: 100,
} as const;

/** Pure world generation: every output depends only on (seed, coordinates). */
export class WorldGenerator {
  readonly field: BiomeField;
  private readonly detail: Noise2D[];

  constructor(readonly seed: number) {
    this.field = new BiomeField(seed);
    const { minScale, maxScale, octaves } = GEN_CONFIG.terrainDetail;
    const span = maxScale - minScale + 1;
    this.detail = TERRAINS.map((_, i) =>
      makeFractalNoise(seed + 1000 + i * 7919, { scale: minScale + ((i * 3) % span), octaves }),
    );
  }

  /** Biome and terrain of a single tile, sampled directly in world coordinates. */
  sampleTile(tx: number, ty: number): { biome: number; terrain: number } {
    const biome = this.field.biomeAt(tx, ty);
    const weights = BIOMES[biome].terrains;
    let best = -1;
    let terrain = 0;
    for (const key in weights) {
      const ti = TERRAIN_INDEX[key as TerrainKey];
      const score = this.detail[ti](tx, ty) * (weights[key as TerrainKey] ?? 0);
      if (score > best) {
        best = score;
        terrain = ti;
      }
    }
    return { biome, terrain };
  }

  isTerrainSolid(biome: number, terrain: number): boolean {
    const t = TERRAINS[terrain];
    return t.solid || (BIOMES[biome].solidTerrains?.includes(t.key) ?? false);
  }

  generateChunk(cx: number, cy: number): ChunkData {
    const chunk = createChunkData(cx, cy);
    const ox = cx * CHUNK_SIZE;
    const oy = cy * CHUNK_SIZE;
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const tx = ox + lx;
        const ty = oy + ly;
        const i = localIndex(lx, ly);
        const { biome, terrain } = this.sampleTile(tx, ty);
        chunk.biome[i] = biome;
        chunk.terrain[i] = terrain;
        if (this.isTerrainSolid(biome, terrain)) {
          chunk.solid[i] = 1;
          continue;
        }
        const block = this.obstacleAt(tx, ty, biome);
        if (block !== NO_BLOCK) {
          chunk.block[i] = block;
          chunk.solid[i] = 1;
          continue;
        }
        chunk.item[i] = this.itemAt(tx, ty, biome);
      }
    }
    this.placeBuildings(chunk);
    return chunk;
  }

  private itemAt(tx: number, ty: number, biome: number): number {
    const def = BIOMES[biome];
    if (hash2(this.seed, tx, ty, SALT.item) >= def.itemChance * GEN_CONFIG.itemDensity) {
      return NO_ITEM;
    }
    const key = pickWeighted(def.items, hash2(this.seed, tx, ty, SALT.itemType));
    return key ? ITEM_ID[key] : NO_ITEM;
  }

  /**
   * A tile is an obstacle candidate when its hash < chance. It wins only if no tile within
   * (minSpacing - 1) has a smaller hash, which enforces spacing using hashes alone, so the
   * result is identical no matter which chunk asks.
   */
  private obstacleAt(tx: number, ty: number, biome: number): number {
    const { chance, minSpacing } = GEN_CONFIG.obstacle;
    const h = hash2(this.seed, tx, ty, SALT.obstacle);
    if (h >= chance) return NO_BLOCK;
    const r = minSpacing - 1;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if ((dx !== 0 || dy !== 0) && hash2(this.seed, tx + dx, ty + dy, SALT.obstacle) < h) {
          return NO_BLOCK;
        }
      }
    }
    const key = pickWeighted(BIOMES[biome].obstacles, hash2(this.seed, tx, ty, SALT.obstacleType));
    return key ? BLOCK_ID[key] : NO_BLOCK;
  }

  private placeBuildings(chunk: ChunkData): void {
    const { attempts, chance } = GEN_CONFIG.building;
    const half = CHUNK_SIZE >> 1;
    const biomeName = BIOMES[chunk.biome[localIndex(half, half)]].name;
    const weights: Record<string, number> = {};
    for (const b of BUILDINGS) {
      const w = b.foundIn[biomeName];
      if (w) weights[b.name] = w;
    }
    const stamped = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);

    for (let a = 0; a < attempts; a++) {
      const salt = SALT.building + a * 4;
      if (hash2(this.seed, chunk.cx, chunk.cy, salt) >= chance) continue;
      const name = pickWeighted(weights, hash2(this.seed, chunk.cx, chunk.cy, salt + 1));
      if (!name) return;
      const b = BUILDING_BY_NAME[name];
      const h = b.blueprint.length;
      const w = b.blueprint[0].length;
      const ox = Math.floor(hash2(this.seed, chunk.cx, chunk.cy, salt + 2) * (CHUNK_SIZE - w + 1));
      const oy = Math.floor(hash2(this.seed, chunk.cx, chunk.cy, salt + 3) * (CHUNK_SIZE - h + 1));
      if (this.canPlace(chunk, b, ox, oy, stamped)) this.stamp(chunk, b, ox, oy, stamped);
    }
  }

  private canPlace(
    chunk: ChunkData,
    b: BuildingDef,
    ox: number,
    oy: number,
    stamped: Uint8Array,
  ): boolean {
    for (let y = 0; y < b.blueprint.length; y++) {
      for (let x = 0; x < b.blueprint[y].length; x++) {
        if (b.blueprint[y][x] === ' ') continue;
        const i = localIndex(ox + x, oy + y);
        if (stamped[i] || this.isTerrainSolid(chunk.biome[i], chunk.terrain[i])) return false;
      }
    }
    return true;
  }

  private stamp(chunk: ChunkData, b: BuildingDef, ox: number, oy: number, stamped: Uint8Array) {
    for (let y = 0; y < b.blueprint.length; y++) {
      for (let x = 0; x < b.blueprint[y].length; x++) {
        const ch = b.blueprint[y][x];
        if (ch === ' ') continue;
        const i = localIndex(ox + x, oy + y);
        const key = BLUEPRINT_CHARS[ch];
        stamped[i] = 1;
        chunk.item[i] = NO_ITEM;
        chunk.block[i] = key ? BLOCK_ID[key] : NO_BLOCK;
        chunk.solid[i] = key ? 1 : 0;
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/world/generator.test.ts`
Expected: PASS. If "places buildings" fails for this seed, raise `GEN_CONFIG.building.chance` to 0.5 and re-run. Don't weaken the test.

- [ ] **Step 5: Commit**

```bash
npm run format && npm run lint
git add src/world tests/world
git commit -m "feat(world): pure chunk generator with items, obstacles and buildings"
```

---

### Task 6: World — chunk cache, diffs, tile queries, spawn

**Files:**
- Create: `src/world/World.ts`
- Test: `tests/world/World.test.ts`

**Interfaces:**
- Consumes: `LruCache` (Task 2); `WorldGenerator`, chunk helpers (Task 5); `hashString` (Task 2); `BIOME_INDEX`, `NO_ITEM` (Task 3).
- Produces:
  - `interface ChunkDiff { picked: number[] }`, `interface TileCoord { tx: number; ty: number }`
  - `ringOffsets(r: number): Array<[number, number]>`
  - `class World(seedText: string, diffs?: Record<string, ChunkDiff>, chunkCacheLimit?: number)` with `readonly seedText`, `readonly seed`, `readonly generator`, `loadedChunkCount`, `getChunk(cx, cy)`, `hasChunk(cx, cy)`, `isSolid(tx, ty)`, `biomeAt(tx, ty)`, `terrainAt(tx, ty)`, `itemAt(tx, ty)`, `takeItem(tx, ty): number`, `exportDiffs(): Record<string, ChunkDiff>`, `findWalkableNear(tx, ty, maxRadius): TileCoord | null`, `findSpawn(): TileCoord`

- [ ] **Step 1: Write the failing test**

`tests/world/World.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { CHUNK_SIZE } from '../../src/config';
import { NO_ITEM } from '../../src/data/items';
import { chunkKey, localIndex, tileToChunk, tileToLocal } from '../../src/world/chunk';
import { World, ringOffsets, type TileCoord } from '../../src/world/World';

/** Scans chunk by chunk (cache-friendly) for the first tile matching the predicate. */
function findTile(world: World, pred: (tx: number, ty: number) => boolean): TileCoord {
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
    const t = findTile(w, (x, y) => w.itemAt(x, y) !== NO_ITEM);
    const id = w.itemAt(t.tx, t.ty);
    expect(w.takeItem(t.tx, t.ty)).toBe(id);
    expect(w.itemAt(t.tx, t.ty)).toBe(NO_ITEM);
    const key = chunkKey(tileToChunk(t.tx), tileToChunk(t.ty));
    expect(w.exportDiffs()[key].picked).toContain(localIndex(tileToLocal(t.tx), tileToLocal(t.ty)));
  });

  it('takeItem on an empty tile returns NO_ITEM and records nothing', () => {
    const w = new World('test');
    const t = findTile(w, (x, y) => w.itemAt(x, y) === NO_ITEM);
    expect(w.takeItem(t.tx, t.ty)).toBe(NO_ITEM);
    expect(w.exportDiffs()).toEqual({});
  });

  it('re-applies diffs when restored from a save', () => {
    const w = new World('test');
    const t = findTile(w, (x, y) => w.itemAt(x, y) !== NO_ITEM);
    w.takeItem(t.tx, t.ty);
    const restored = new World('test', w.exportDiffs());
    expect(restored.itemAt(t.tx, t.ty)).toBe(NO_ITEM);
  });

  it('keeps picked items gone after the chunk is evicted and regenerated', () => {
    const w = new World('test', {}, 2);
    const t = findTile(w, (x, y) => w.itemAt(x, y) !== NO_ITEM);
    w.takeItem(t.tx, t.ty);
    w.getChunk(50, 50);
    w.getChunk(51, 51);
    w.getChunk(52, 52);
    expect(w.itemAt(t.tx, t.ty)).toBe(NO_ITEM);
  });

  it('exportDiffs returns a copy', () => {
    const w = new World('test');
    const t = findTile(w, (x, y) => w.itemAt(x, y) !== NO_ITEM);
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
    const open = findTile(w, (x, y) => !w.isSolid(x, y));
    expect(w.findWalkableNear(open.tx, open.ty, 8)).toEqual(open);
    const solid = findTile(w, (x, y) => w.isSolid(x, y));
    const r = w.findWalkableNear(solid.tx, solid.ty, 64);
    expect(r).not.toBeNull();
    expect(w.isSolid(r!.tx, r!.ty)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/world/World.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/world/World.ts`**

```ts
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

  findWalkableNear(tx: number, ty: number, maxRadius: number): TileCoord | null {
    return this.search(tx, ty, maxRadius, (x, y) => !this.isSolid(x, y));
  }

  /** Nearest walkable tile to the origin, preferring Grassland or Forest within 64 tiles. */
  findSpawn(): TileCoord {
    return (
      this.search(0, 0, 64, (x, y) => !this.isSolid(x, y) && SPAWN_BIOMES.has(this.biomeAt(x, y))) ??
      this.findWalkableNear(0, 0, 256) ?? { tx: 0, ty: 0 }
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/world`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run format && npm run lint
git add src/world tests/world
git commit -m "feat(world): World with chunk LRU, item diffs and spawn search"
```

---

### Task 7: Player, effects and energy

**Files:**
- Create: `src/entities/Player.ts`, `src/systems/effects.ts`, `src/systems/energy.ts`
- Test: `tests/systems/effects.test.ts`, `tests/systems/energy.test.ts`

**Interfaces:**
- Consumes: `EffectKind` (Task 3); config constants (Task 1).
- Produces:
  - `HITBOX_HALF_W = 5`, `HITBOX_H = 8`; `interface ActiveEffect { kind: EffectKind; remaining: number }`
  - `class Player` with fields `x, y` (feet centre, world px), `vx, vy`, `facing: 1 | -1`, `moving`, `energy`, `treasures`, `effects: ActiveEffect[]`, `animTime`; methods `placeAtTile(tx, ty)`, `tileX()`, `tileY()`
  - `EFFECT_SPEED: Record<EffectKind, number>`, `addEffect(effects, kind, duration)`, `tickEffects(effects, dt)`, `hasEffect(effects, kind)`, `effectSpeedMultiplier(effects)`
  - `ENERGY_DRAIN_PER_SEC = 1/6`, `ENERGY_REGEN_PER_SEC = 1/3`, `tickEnergy(player, dt, biomeEffect?: BiomeEffect)`, `changeEnergy(player, amount)`, `isTired(player)`

- [ ] **Step 1: Write the failing tests**

`tests/systems/effects.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { ActiveEffect } from '../../src/entities/Player';
import {
  addEffect,
  effectSpeedMultiplier,
  hasEffect,
  tickEffects,
} from '../../src/systems/effects';

describe('effects', () => {
  it('refreshes an active effect instead of stacking it', () => {
    const fx: ActiveEffect[] = [];
    addEffect(fx, 'zoom', 10);
    tickEffects(fx, 6);
    addEffect(fx, 'zoom', 10);
    expect(fx).toEqual([{ kind: 'zoom', remaining: 10 }]);
  });

  it('expires effects and restores speed (legacy sticky bug)', () => {
    const fx: ActiveEffect[] = [];
    addEffect(fx, 'sap', 6);
    expect(effectSpeedMultiplier(fx)).toBeCloseTo(0.6);
    tickEffects(fx, 6);
    expect(hasEffect(fx, 'sap')).toBe(false);
    expect(effectSpeedMultiplier(fx)).toBe(1);
  });

  it('multiplies speed of concurrent effects', () => {
    const fx: ActiveEffect[] = [];
    addEffect(fx, 'zoom', 10);
    addEffect(fx, 'sap', 6);
    expect(effectSpeedMultiplier(fx)).toBeCloseTo(1.8 * 0.6);
  });
});
```

`tests/systems/energy.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { MAX_ENERGY } from '../../src/config';
import { Player } from '../../src/entities/Player';
import { changeEnergy, isTired, tickEnergy } from '../../src/systems/energy';

function playerWith(energy: number, moving: boolean): Player {
  const p = new Player();
  p.energy = energy;
  p.moving = moving;
  return p;
}

describe('energy', () => {
  it('drains 1 point per 6 seconds while moving', () => {
    const p = playerWith(50, true);
    tickEnergy(p, 6);
    expect(p.energy).toBeCloseTo(49);
  });

  it('does not drain while standing still', () => {
    const p = playerWith(50, false);
    tickEnergy(p, 60);
    expect(p.energy).toBe(50);
  });

  it('drains twice as fast in decay biomes', () => {
    const p = playerWith(50, true);
    tickEnergy(p, 6, 'decay');
    expect(p.energy).toBeCloseTo(48);
  });

  it('regenerates in heal biomes, even while still', () => {
    const p = playerWith(50, false);
    tickEnergy(p, 3, 'heal');
    expect(p.energy).toBeCloseTo(51);
  });

  it('clamps to [0, MAX_ENERGY] and reports tired at 0', () => {
    const p = playerWith(1, true);
    tickEnergy(p, 600);
    expect(p.energy).toBe(0);
    expect(isTired(p)).toBe(true);
    changeEnergy(p, 1000);
    expect(p.energy).toBe(MAX_ENERGY);
    expect(isTired(p)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/systems`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`src/entities/Player.ts`:
```ts
import { MAX_ENERGY, TILE_PX } from '../config';
import type { EffectKind } from '../data/items';

export const HITBOX_HALF_W = 5;
export const HITBOX_H = 8;

export interface ActiveEffect {
  kind: EffectKind;
  /** Seconds left. */
  remaining: number;
}

export class Player {
  /** Centre of the feet, in world pixels. The hitbox spans x±5, y-8..y. */
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  facing: 1 | -1 = 1;
  moving = false;
  energy = MAX_ENERGY;
  treasures = 0;
  effects: ActiveEffect[] = [];
  animTime = 0;

  /** Puts the hitbox fully inside the given tile. */
  placeAtTile(tx: number, ty: number): void {
    this.x = tx * TILE_PX + TILE_PX / 2;
    this.y = ty * TILE_PX + TILE_PX - 4;
    this.vx = 0;
    this.vy = 0;
  }

  tileX(): number {
    return Math.floor(this.x / TILE_PX);
  }

  /** Tile under the middle of the hitbox. */
  tileY(): number {
    return Math.floor((this.y - HITBOX_H / 2) / TILE_PX);
  }
}
```

`src/systems/effects.ts`:
```ts
import type { EffectKind } from '../data/items';
import type { ActiveEffect } from '../entities/Player';

export const EFFECT_SPEED: Record<EffectKind, number> = {
  zoom: 1.8,
  sap: 0.6,
  magnet: 1,
  wobble: 1,
};

/** Adds an effect, or refreshes its timer if already active (never stacks). */
export function addEffect(effects: ActiveEffect[], kind: EffectKind, duration: number): void {
  const existing = effects.find((e) => e.kind === kind);
  if (existing) existing.remaining = Math.max(existing.remaining, duration);
  else effects.push({ kind, remaining: duration });
}

export function tickEffects(effects: ActiveEffect[], dt: number): void {
  for (const e of effects) e.remaining -= dt;
  for (let i = effects.length - 1; i >= 0; i--) {
    if (effects[i].remaining <= 0) effects.splice(i, 1);
  }
}

export function hasEffect(effects: readonly ActiveEffect[], kind: EffectKind): boolean {
  return effects.some((e) => e.kind === kind);
}

export function effectSpeedMultiplier(effects: readonly ActiveEffect[]): number {
  return effects.reduce((m, e) => m * EFFECT_SPEED[e.kind], 1);
}
```

`src/systems/energy.ts`:
```ts
import { MAX_ENERGY } from '../config';
import type { BiomeEffect } from '../data/biomes';
import type { Player } from '../entities/Player';

export const ENERGY_DRAIN_PER_SEC = 1 / 6;
export const ENERGY_REGEN_PER_SEC = 1 / 3;

export function changeEnergy(player: Player, amount: number): void {
  player.energy = Math.min(MAX_ENERGY, Math.max(0, player.energy + amount));
}

export function tickEnergy(player: Player, dt: number, biomeEffect?: BiomeEffect): void {
  let delta = 0;
  if (player.moving) delta -= ENERGY_DRAIN_PER_SEC * (biomeEffect === 'decay' ? 2 : 1) * dt;
  if (biomeEffect === 'heal') delta += ENERGY_REGEN_PER_SEC * dt;
  changeEnergy(player, delta);
}

export function isTired(player: Player): boolean {
  return player.energy <= 0;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/systems`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run format && npm run lint
git add src/entities src/systems tests/systems
git commit -m "feat(systems): player state, timed effects and gentle energy"
```

---

### Task 8: Movement, collision and unstick

**Files:**
- Create: `src/systems/movement.ts`
- Test: `tests/systems/movement.test.ts`

**Interfaces:**
- Consumes: `Player`, `HITBOX_HALF_W`, `HITBOX_H` (Task 7); `effectSpeedMultiplier`, `hasEffect`, `addEffect` (Task 7); `isTired` (Task 7); `TerrainDef` (Task 3); `Vec2` (Task 2); `TileCoord` (Task 6).
- Produces:
  - `type SolidFn = (tx: number, ty: number) => boolean`
  - `interface MovementEnv { isSolid: SolidFn; terrainAt: (tx, ty) => TerrainDef }`
  - `hitboxHitsSolid(x, y, isSolid): boolean`
  - `moveAxis(p, axis: 'x' | 'y', delta, isSolid): void`
  - `updateMovement(p, input: Vec2, dt, env): void`
  - `interface UnstickWorld { isSolid: SolidFn; findWalkableNear(tx, ty, maxRadius): TileCoord | null }`, `unstick(p, world): boolean`

- [ ] **Step 1: Write the failing test**

`tests/systems/movement.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { BASE_SPEED, TICK_DT } from '../../src/config';
import { hash2, mulberry32 } from '../../src/core/rng';
import type { Vec2 } from '../../src/core/vec';
import { TERRAINS, TERRAIN_INDEX, type TerrainDef } from '../../src/data/terrains';
import { Player } from '../../src/entities/Player';
import { addEffect } from '../../src/systems/effects';
import {
  hitboxHitsSolid,
  moveAxis,
  unstick,
  updateMovement,
  type MovementEnv,
  type SolidFn,
} from '../../src/systems/movement';

const GRASS = TERRAINS[TERRAIN_INDEX.grass];
const MUD = TERRAINS[TERRAIN_INDEX.mud];
const ICE = TERRAINS[TERRAIN_INDEX.ice];
const RIGHT: Vec2 = { x: 1, y: 0 };
const STOP: Vec2 = { x: 0, y: 0 };

function solidSet(tiles: Array<[number, number]>): SolidFn {
  const s = new Set(tiles.map(([x, y]) => `${x},${y}`));
  return (tx, ty) => s.has(`${tx},${ty}`);
}

function env(isSolid: SolidFn = () => false, terrain: TerrainDef = GRASS): MovementEnv {
  return { isSolid, terrainAt: () => terrain };
}

function run(p: Player, input: Vec2, seconds: number, e: MovementEnv): void {
  for (let i = 0; i < Math.round(seconds / TICK_DT); i++) updateMovement(p, input, TICK_DT, e);
}

function distanceRight(setup: (p: Player) => void, e: MovementEnv = env()): number {
  const p = new Player();
  p.placeAtTile(0, 0);
  setup(p);
  const x0 = p.x;
  run(p, RIGHT, 1, e);
  return p.x - x0;
}

describe('movement', () => {
  it('moves at about base speed in the open', () => {
    const d = distanceRight(() => {});
    expect(d).toBeGreaterThan(BASE_SPEED * 0.9);
    expect(d).toBeLessThanOrEqual(BASE_SPEED);
  });

  it('stops flush against a wall', () => {
    const wall = solidSet(Array.from({ length: 11 }, (_, i) => [3, i - 5] as [number, number]));
    const p = new Player();
    p.placeAtTile(0, 0);
    run(p, RIGHT, 2, env(wall));
    expect(p.x + 5).toBeLessThanOrEqual(48);
    expect(p.x + 5).toBeGreaterThan(46);
  });

  it('slides along a wall when moving diagonally', () => {
    const wall = solidSet(Array.from({ length: 20 }, (_, i) => [1, i - 5] as [number, number]));
    const p = new Player();
    p.placeAtTile(0, 0);
    const y0 = p.y;
    run(p, { x: Math.SQRT1_2, y: Math.SQRT1_2 }, 1, env(wall));
    expect(p.y - y0).toBeGreaterThan(40);
    expect(p.x + 5).toBeLessThanOrEqual(16);
  });

  it('does not tunnel through a one-tile wall with a huge step', () => {
    const p = new Player();
    p.placeAtTile(0, 0);
    moveAxis(p, 'x', 40, solidSet([[1, 0]]));
    expect(p.x + 5).toBeLessThanOrEqual(16);
  });

  it('never ends inside a solid tile under random input', () => {
    const isSolid: SolidFn = (tx, ty) =>
      Math.max(Math.abs(tx), Math.abs(ty)) > 1 && hash2(5, tx, ty) < 0.25;
    const p = new Player();
    p.placeAtTile(0, 0);
    addEffect(p.effects, 'zoom', 1000);
    const r = mulberry32(3);
    let dir: Vec2 = STOP;
    let violations = 0;
    for (let i = 0; i < 3000; i++) {
      if (i % 20 === 0) {
        const a = r() * Math.PI * 2;
        dir = { x: Math.cos(a), y: Math.sin(a) };
      }
      updateMovement(p, dir, TICK_DT, env(isSolid));
      if (hitboxHitsSolid(p.x, p.y, isSolid)) violations++;
    }
    expect(violations).toBe(0);
  });

  it('is slower on mud', () => {
    expect(distanceRight(() => {}, env(undefined, MUD))).toBeLessThan(
      distanceRight(() => {}) * 0.75,
    );
  });

  it('halves speed when tired', () => {
    const ratio = distanceRight((p) => (p.energy = 0)) / distanceRight(() => {});
    expect(ratio).toBeGreaterThan(0.45);
    expect(ratio).toBeLessThan(0.55);
  });

  it('is faster with the zoom effect', () => {
    expect(distanceRight((p) => addEffect(p.effects, 'zoom', 10))).toBeGreaterThan(
      distanceRight(() => {}) * 1.6,
    );
  });

  it('keeps momentum on ice after input stops', () => {
    const coast = (terrain: TerrainDef) => {
      const p = new Player();
      p.placeAtTile(0, 0);
      run(p, RIGHT, 1, env(undefined, terrain));
      const x0 = p.x;
      run(p, STOP, 0.5, env(undefined, terrain));
      return p.x - x0;
    };
    expect(coast(ICE)).toBeGreaterThan(coast(GRASS) * 3);
  });

  it('wobble bends a straight path', () => {
    const p = new Player();
    p.placeAtTile(0, 0);
    addEffect(p.effects, 'wobble', 1.5);
    const y0 = p.y;
    let maxDev = 0;
    for (let i = 0; i < 30; i++) {
      updateMovement(p, RIGHT, TICK_DT, env());
      maxDev = Math.max(maxDev, Math.abs(p.y - y0));
    }
    expect(maxDev).toBeGreaterThan(1);
  });

  it('marks moving and facing from input', () => {
    const p = new Player();
    updateMovement(p, { x: -1, y: 0 }, TICK_DT, env());
    expect(p.moving).toBe(true);
    expect(p.facing).toBe(-1);
    updateMovement(p, STOP, TICK_DT, env());
    expect(p.moving).toBe(false);
  });
});

describe('unstick', () => {
  it('moves a player out of a solid tile', () => {
    const p = new Player();
    p.placeAtTile(0, 0);
    const moved = unstick(p, {
      isSolid: solidSet([[0, 0]]),
      findWalkableNear: () => ({ tx: 5, ty: 5 }),
    });
    expect(moved).toBe(true);
    expect([p.tileX(), p.tileY()]).toEqual([5, 5]);
  });

  it('leaves a free player alone', () => {
    const p = new Player();
    p.placeAtTile(2, 2);
    const before = [p.x, p.y];
    expect(unstick(p, { isSolid: () => false, findWalkableNear: () => null })).toBe(false);
    expect([p.x, p.y]).toEqual(before);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/systems/movement.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/systems/movement.ts`**

```ts
import { BASE_SPEED, TILE_PX, TIRED_SPEED_MULT } from '../config';
import type { Vec2 } from '../core/vec';
import type { TerrainDef } from '../data/terrains';
import { HITBOX_H, HITBOX_HALF_W, type Player } from '../entities/Player';
import type { TileCoord } from '../world/World';
import { effectSpeedMultiplier, hasEffect } from './effects';
import { isTired } from './energy';

export type SolidFn = (tx: number, ty: number) => boolean;

export interface MovementEnv {
  isSolid: SolidFn;
  terrainAt: (tx: number, ty: number) => TerrainDef;
}

/** Velocity response per second on normal ground and on slippery ground. */
const ACCEL = 20;
const ICE_ACCEL = 3;
const WOBBLE_FREQ = 12;
const WOBBLE_ANGLE = 0.6;
const EPS = 1e-6;

export function hitboxHitsSolid(x: number, y: number, isSolid: SolidFn): boolean {
  const x0 = Math.floor((x - HITBOX_HALF_W) / TILE_PX);
  const x1 = Math.floor((x + HITBOX_HALF_W - EPS) / TILE_PX);
  const y0 = Math.floor((y - HITBOX_H) / TILE_PX);
  const y1 = Math.floor((y - EPS) / TILE_PX);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (isSolid(tx, ty)) return true;
    }
  }
  return false;
}

/** Moves along one axis in steps of at most 1 px, stopping at the first collision. */
export function moveAxis(p: Player, axis: 'x' | 'y', delta: number, isSolid: SolidFn): void {
  if (delta === 0) return;
  const steps = Math.ceil(Math.abs(delta));
  const step = delta / steps;
  for (let i = 0; i < steps; i++) {
    const nx = axis === 'x' ? p.x + step : p.x;
    const ny = axis === 'y' ? p.y + step : p.y;
    if (hitboxHitsSolid(nx, ny, isSolid)) {
      if (axis === 'x') p.vx = 0;
      else p.vy = 0;
      return;
    }
    p.x = nx;
    p.y = ny;
  }
}

function wobble(dir: Vec2, time: number): Vec2 {
  const a = Math.sin(time * WOBBLE_FREQ) * WOBBLE_ANGLE;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return { x: dir.x * cos - dir.y * sin, y: dir.x * sin + dir.y * cos };
}

export function updateMovement(p: Player, input: Vec2, dt: number, env: MovementEnv): void {
  const terrain = env.terrainAt(p.tileX(), p.tileY());
  const hasInput = input.x !== 0 || input.y !== 0;
  const dir = hasInput && hasEffect(p.effects, 'wobble') ? wobble(input, p.animTime) : input;
  const speed =
    BASE_SPEED *
    terrain.speed *
    effectSpeedMultiplier(p.effects) *
    (isTired(p) ? TIRED_SPEED_MULT : 1);
  const k = Math.min(1, (terrain.slippery ? ICE_ACCEL : ACCEL) * dt);

  p.vx += (dir.x * speed - p.vx) * k;
  p.vy += (dir.y * speed - p.vy) * k;
  if (!hasInput && Math.hypot(p.vx, p.vy) < 0.5) {
    p.vx = 0;
    p.vy = 0;
  }

  moveAxis(p, 'x', p.vx * dt, env.isSolid);
  moveAxis(p, 'y', p.vy * dt, env.isSolid);

  p.moving = hasInput;
  if (input.x !== 0) p.facing = input.x > 0 ? 1 : -1;
  p.animTime += dt;
}

export interface UnstickWorld {
  isSolid: SolidFn;
  findWalkableNear(tx: number, ty: number, maxRadius: number): TileCoord | null;
}

/** If the player overlaps a solid tile (e.g. after loading an old save), move them out. */
export function unstick(p: Player, world: UnstickWorld): boolean {
  if (!hitboxHitsSolid(p.x, p.y, world.isSolid)) return false;
  const t = world.findWalkableNear(p.tileX(), p.tileY(), 64);
  if (t) p.placeAtTile(t.tx, t.ty);
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/systems`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run format && npm run lint
git add src/systems tests/systems
git commit -m "feat(systems): movement with axis-separated collision, ice and unstick"
```

---

### Task 9: Pickups and biome discovery

**Files:**
- Create: `src/systems/pickups.ts`, `src/systems/discovery.ts`
- Test: `tests/systems/pickups.test.ts`, `tests/systems/discovery.test.ts`

**Interfaces:**
- Consumes: `Player`, hitbox constants (Task 7); `addEffect`, `hasEffect`, `changeEnergy` (Task 7); `itemById`, `NO_ITEM`, `ItemDef` (Task 3); `BIOMES` (Task 3).
- Produces:
  - `interface PickupEvent { itemId; tx; ty; magnet: boolean }`, `interface PickupWorld { itemAt(tx, ty): number; takeItem(tx, ty): number }`
  - `applyItem(p, item: ItemDef): void`, `collectItems(p, world: PickupWorld): PickupEvent[]`
  - `BIOME_STABLE_SECONDS = 0.4`, `interface DiscoveryState { currentBiome: number | null; candidate: number | null; candidateTime: number; discovered: Set<string> }`, `createDiscoveryState(discovered?: Iterable<string>)`, `interface BiomeChange { biome: number; isNew: boolean }`, `updateDiscovery(state, biome, dt): BiomeChange | null`

- [ ] **Step 1: Write the failing tests**

`tests/systems/pickups.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { ITEM_ID, NO_ITEM } from '../../src/data/items';
import { Player } from '../../src/entities/Player';
import { addEffect, hasEffect } from '../../src/systems/effects';
import { collectItems, type PickupWorld } from '../../src/systems/pickups';

class FakeWorld implements PickupWorld {
  items = new Map<string, number>();
  put(tx: number, ty: number, id: number): this {
    this.items.set(`${tx},${ty}`, id);
    return this;
  }
  itemAt(tx: number, ty: number): number {
    return this.items.get(`${tx},${ty}`) ?? NO_ITEM;
  }
  takeItem(tx: number, ty: number): number {
    const id = this.itemAt(tx, ty);
    this.items.delete(`${tx},${ty}`);
    return id;
  }
}

function playerAt(tx: number, ty: number, energy = 50): Player {
  const p = new Player();
  p.placeAtTile(tx, ty);
  p.energy = energy;
  return p;
}

describe('collectItems', () => {
  it('collects the item under Gizmo and applies a berry', () => {
    const w = new FakeWorld().put(2, 2, ITEM_ID.berry);
    const p = playerAt(2, 2);
    const events = collectItems(p, w);
    expect(events).toEqual([{ itemId: ITEM_ID.berry, tx: 2, ty: 2, magnet: false }]);
    expect(p.energy).toBe(65);
    expect(p.treasures).toBe(1);
    expect(w.itemAt(2, 2)).toBe(NO_ITEM);
  });

  it('ignores items that are not under the hitbox', () => {
    const w = new FakeWorld().put(4, 2, ITEM_ID.berry);
    expect(collectItems(playerAt(2, 2), w)).toEqual([]);
  });

  it('golden fruit fills energy; zoom leaf adds an effect', () => {
    const p = playerAt(2, 2, 10);
    collectItems(p, new FakeWorld().put(2, 2, ITEM_ID.golden));
    expect(p.energy).toBe(100);
    collectItems(p, new FakeWorld().put(2, 2, ITEM_ID.zoom));
    expect(hasEffect(p.effects, 'zoom')).toBe(true);
    expect(p.treasures).toBe(5 + 2);
  });

  it('sour berry costs energy and wobbles, never below zero', () => {
    const p = playerAt(2, 2, 5);
    collectItems(p, new FakeWorld().put(2, 2, ITEM_ID.sour));
    expect(p.energy).toBe(0);
    expect(hasEffect(p.effects, 'wobble')).toBe(true);
  });

  it('magnet collects items within 4 tiles and flags them', () => {
    const w = new FakeWorld().put(5, 2, ITEM_ID.berry).put(7, 2, ITEM_ID.berry);
    const p = playerAt(2, 2);
    addEffect(p.effects, 'magnet', 15);
    const events = collectItems(p, w);
    expect(events).toEqual([{ itemId: ITEM_ID.berry, tx: 5, ty: 2, magnet: true }]);
    expect(w.itemAt(7, 2)).toBe(ITEM_ID.berry);
  });
});
```

`tests/systems/discovery.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { BIOME_INDEX } from '../../src/data/biomes';
import { createDiscoveryState, updateDiscovery } from '../../src/systems/discovery';

const FOREST = BIOME_INDEX.Forest;
const DESERT = BIOME_INDEX.Desert;

describe('updateDiscovery', () => {
  it('commits the first biome immediately as new', () => {
    const s = createDiscoveryState();
    expect(updateDiscovery(s, FOREST, 0.1)).toEqual({ biome: FOREST, isNew: true });
    expect(updateDiscovery(s, FOREST, 0.1)).toBeNull();
  });

  it('requires a new biome to hold for 0.4 s', () => {
    const s = createDiscoveryState();
    updateDiscovery(s, FOREST, 0.1);
    for (let i = 0; i < 4; i++) expect(updateDiscovery(s, DESERT, 0.1)).toBeNull();
    expect(updateDiscovery(s, DESERT, 0.1)).toEqual({ biome: DESERT, isNew: true });
  });

  it('flickering back across a border resets the timer (no toast spam)', () => {
    const s = createDiscoveryState();
    updateDiscovery(s, FOREST, 0.1);
    for (let i = 0; i < 20; i++) {
      expect(updateDiscovery(s, DESERT, 0.1)).toBeNull();
      expect(updateDiscovery(s, DESERT, 0.1)).toBeNull();
      expect(updateDiscovery(s, FOREST, 0.1)).toBeNull();
    }
  });

  it('reports known biomes as not new', () => {
    const s = createDiscoveryState(['Forest']);
    expect(updateDiscovery(s, FOREST, 0.1)).toEqual({ biome: FOREST, isNew: false });
    expect(s.discovered.has('Forest')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/systems`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`src/systems/pickups.ts`:
```ts
import { MAGNET_RADIUS_TILES, MAX_ENERGY, TILE_PX } from '../config';
import { NO_ITEM, itemById, type ItemDef } from '../data/items';
import { HITBOX_H, HITBOX_HALF_W, type Player } from '../entities/Player';
import { addEffect, hasEffect } from './effects';
import { changeEnergy } from './energy';

export interface PickupEvent {
  itemId: number;
  tx: number;
  ty: number;
  /** True when pulled in by the magnet (the renderer animates these flying in). */
  magnet: boolean;
}

export interface PickupWorld {
  itemAt(tx: number, ty: number): number;
  takeItem(tx: number, ty: number): number;
}

const EPS = 1e-6;

export function applyItem(p: Player, item: ItemDef): void {
  p.treasures += item.treasure;
  for (const e of item.effects) {
    switch (e.kind) {
      case 'energy':
        changeEnergy(p, e.amount);
        break;
      case 'energyFull':
        p.energy = MAX_ENERGY;
        break;
      case 'timed':
        addEffect(p.effects, e.effect, e.duration);
        break;
    }
  }
}

export function collectItems(p: Player, world: PickupWorld): PickupEvent[] {
  const events: PickupEvent[] = [];
  const take = (tx: number, ty: number, magnet: boolean) => {
    if (world.itemAt(tx, ty) === NO_ITEM) return;
    const id = world.takeItem(tx, ty);
    const def = itemById(id);
    if (!def) return;
    applyItem(p, def);
    events.push({ itemId: id, tx, ty, magnet });
  };

  const x0 = Math.floor((p.x - HITBOX_HALF_W) / TILE_PX);
  const x1 = Math.floor((p.x + HITBOX_HALF_W - EPS) / TILE_PX);
  const y0 = Math.floor((p.y - HITBOX_H) / TILE_PX);
  const y1 = Math.floor((p.y - EPS) / TILE_PX);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) take(tx, ty, false);

  if (hasEffect(p.effects, 'magnet')) {
    const r = MAGNET_RADIUS_TILES;
    const cx = p.tileX();
    const cy = p.tileY();
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r) take(cx + dx, cy + dy, true);
      }
    }
  }
  return events;
}
```

`src/systems/discovery.ts`:
```ts
import { BIOMES } from '../data/biomes';

/** A new biome must persist this long before it counts (prevents border flicker). */
export const BIOME_STABLE_SECONDS = 0.4;

export interface DiscoveryState {
  currentBiome: number | null;
  candidate: number | null;
  candidateTime: number;
  discovered: Set<string>;
}

export interface BiomeChange {
  biome: number;
  isNew: boolean;
}

export function createDiscoveryState(discovered: Iterable<string> = []): DiscoveryState {
  return { currentBiome: null, candidate: null, candidateTime: 0, discovered: new Set(discovered) };
}

export function updateDiscovery(
  s: DiscoveryState,
  biome: number,
  dt: number,
): BiomeChange | null {
  if (biome === s.currentBiome) {
    s.candidate = null;
    s.candidateTime = 0;
    return null;
  }
  if (s.currentBiome !== null) {
    if (s.candidate !== biome) {
      s.candidate = biome;
      s.candidateTime = 0;
      return null;
    }
    s.candidateTime += dt;
    if (s.candidateTime < BIOME_STABLE_SECONDS) return null;
  }
  s.currentBiome = biome;
  s.candidate = null;
  s.candidateTime = 0;
  const name = BIOMES[biome].name;
  const isNew = !s.discovered.has(name);
  s.discovered.add(name);
  return { biome, isNew };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/systems`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run format && npm run lint
git add src/systems tests/systems
git commit -m "feat(systems): item pickups with magnet and biome discovery hysteresis"
```

---

### Task 10: Save format and storage

**Files:**
- Create: `src/save/storage.ts`
- Test: `tests/save/storage.test.ts`

**Interfaces:**
- Consumes: `EFFECT_KINDS`, `EffectKind` (Task 3); `ActiveEffect` (Task 7); `ChunkDiff` (Task 6); `SAVE_KEY`, `CHUNK_SIZE` (Task 1).
- Produces:
  - `SAVE_VERSION = 1`, `interface SaveData { version: 1; seed: string; player: { x; y; energy; treasures; effects: ActiveEffect[] }; discoveredBiomes: string[]; chunkDiffs: Record<string, ChunkDiff> }`
  - `class SaveError extends Error`
  - `validateSave(o: unknown): o is SaveData`, `migrate(o: unknown): unknown`, `parseSave(raw: string): SaveData` (throws `SaveError`)
  - `interface KeyValueStore { getItem(key): string | null; setItem(key, value): void }`
  - `type LoadResult = { status: 'empty' } | { status: 'ok'; data: SaveData } | { status: 'corrupt'; backupKey: string }`
  - `loadSave(store, now?: number): LoadResult`, `writeSave(store, data): boolean`, `getBrowserStore(): KeyValueStore | null`

- [ ] **Step 1: Write the failing test**

`tests/save/storage.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { SAVE_KEY } from '../../src/config';
import {
  SaveError,
  loadSave,
  parseSave,
  writeSave,
  type KeyValueStore,
  type SaveData,
} from '../../src/save/storage';

const valid: SaveData = {
  version: 1,
  seed: 'maple-17',
  player: { x: 10, y: 20, energy: 80, treasures: 3, effects: [{ kind: 'zoom', remaining: 4 }] },
  discoveredBiomes: ['Forest'],
  chunkDiffs: { '0,0': { picked: [1, 2] }, '-1,3': { picked: [] } },
};

class MemoryStore implements KeyValueStore {
  data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

class FullStore extends MemoryStore {
  setItem(): void {
    throw new Error('QuotaExceededError');
  }
}

const mutate = (fn: (o: Record<string, unknown>) => void): string => {
  const o = structuredClone(valid) as unknown as Record<string, unknown>;
  fn(o);
  return JSON.stringify(o);
};

describe('save storage', () => {
  it('round-trips through the store', () => {
    const store = new MemoryStore();
    expect(writeSave(store, valid)).toBe(true);
    expect(loadSave(store)).toEqual({ status: 'ok', data: valid });
  });

  it('reports an empty store', () => {
    expect(loadSave(new MemoryStore())).toEqual({ status: 'empty' });
  });

  it('backs up a corrupt save instead of losing it', () => {
    const store = new MemoryStore();
    store.setItem(SAVE_KEY, '{not json');
    const r = loadSave(store, 1000);
    expect(r).toEqual({ status: 'corrupt', backupKey: `${SAVE_KEY}.corrupt-1000` });
    expect(store.getItem(`${SAVE_KEY}.corrupt-1000`)).toBe('{not json');
  });

  it('still reports corrupt when the backup cannot be written', () => {
    const store = new FullStore();
    store.data.set(SAVE_KEY, 'garbage');
    expect(loadSave(store, 5).status).toBe('corrupt');
  });

  it('writeSave returns false when storage is full', () => {
    expect(writeSave(new FullStore(), valid)).toBe(false);
  });

  it.each([
    ['newer version', mutate((o) => (o.version = 2))],
    ['missing seed', mutate((o) => delete o.seed)],
    ['empty seed', mutate((o) => (o.seed = ''))],
    ['bad energy', mutate((o) => ((o.player as Record<string, unknown>).energy = 'full'))],
    [
      'unknown effect',
      mutate((o) => ((o.player as Record<string, unknown>).effects = [{ kind: 'fly', remaining: 1 }])),
    ],
    ['picked out of range', mutate((o) => (o.chunkDiffs = { '0,0': { picked: [1024] } }))],
    ['negative picked', mutate((o) => (o.chunkDiffs = { '0,0': { picked: [-1] } }))],
    ['biomes not strings', mutate((o) => (o.discoveredBiomes = [1]))],
    ['array instead of object', '[]'],
    ['not json', 'hello'],
  ])('rejects %s', (_label, raw) => {
    expect(() => parseSave(raw)).toThrow(SaveError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/save`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/save/storage.ts`**

```ts
import { CHUNK_SIZE, SAVE_KEY } from '../config';
import { EFFECT_KINDS } from '../data/items';
import type { ActiveEffect } from '../entities/Player';
import type { ChunkDiff } from '../world/World';

export const SAVE_VERSION = 1;

export interface SaveData {
  version: 1;
  seed: string;
  player: { x: number; y: number; energy: number; treasures: number; effects: ActiveEffect[] };
  discoveredBiomes: string[];
  chunkDiffs: Record<string, ChunkDiff>;
}

export class SaveError extends Error {}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type LoadResult =
  | { status: 'empty' }
  | { status: 'ok'; data: SaveData }
  | { status: 'corrupt'; backupKey: string };

const AREA = CHUNK_SIZE * CHUNK_SIZE;
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function validateSave(o: unknown): o is SaveData {
  if (!isObj(o) || o.version !== SAVE_VERSION) return false;
  if (typeof o.seed !== 'string' || o.seed.length === 0) return false;
  const p = o.player;
  if (!isObj(p) || !isNum(p.x) || !isNum(p.y) || !isNum(p.energy) || !isNum(p.treasures)) {
    return false;
  }
  if (!Array.isArray(p.effects)) return false;
  const kinds: readonly string[] = EFFECT_KINDS;
  for (const e of p.effects) {
    if (!isObj(e) || typeof e.kind !== 'string' || !kinds.includes(e.kind) || !isNum(e.remaining)) {
      return false;
    }
  }
  if (!Array.isArray(o.discoveredBiomes) || !o.discoveredBiomes.every((b) => typeof b === 'string')) {
    return false;
  }
  if (!isObj(o.chunkDiffs)) return false;
  for (const d of Object.values(o.chunkDiffs)) {
    if (!isObj(d) || !Array.isArray(d.picked)) return false;
    if (!d.picked.every((i) => Number.isInteger(i) && i >= 0 && i < AREA)) return false;
  }
  return true;
}

/**
 * Upgrades older save shapes to the current version. v1 is the first version; future
 * versions add steps here, e.g. `if (o.version === 1) o = v1ToV2(o);`.
 */
export function migrate(o: unknown): unknown {
  return o;
}

export function parseSave(raw: string): SaveData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new SaveError('Save is not valid JSON');
  }
  const migrated = migrate(parsed);
  if (!validateSave(migrated)) throw new SaveError('Save has an unexpected shape or version');
  return migrated;
}

export function loadSave(store: KeyValueStore, now = Date.now()): LoadResult {
  const raw = store.getItem(SAVE_KEY);
  if (raw === null) return { status: 'empty' };
  try {
    return { status: 'ok', data: parseSave(raw) };
  } catch {
    const backupKey = `${SAVE_KEY}.corrupt-${now}`;
    try {
      store.setItem(backupKey, raw);
    } catch {
      // Storage full: the original is still under SAVE_KEY until the next save.
    }
    return { status: 'corrupt', backupKey };
  }
}

export function writeSave(store: KeyValueStore, data: SaveData): boolean {
  try {
    store.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** localStorage if it is usable (it throws in some private modes), else null. */
export function getBrowserStore(): KeyValueStore | null {
  try {
    const s = window.localStorage;
    const probe = 'gizmo.probe';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/save`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run format && npm run lint
git add src/save tests/save
git commit -m "feat(save): versioned save schema with validation and corrupt backup"
```

---

### Task 11: Input — keyboard, touch joystick, combined

**Files:**
- Create: `src/input/keyboard.ts`, `src/input/touchJoystick.ts`, `src/input/Input.ts`
- Test: `tests/input/input.test.ts`

**Interfaces:**
- Consumes: `Vec2`, `normalize`, `ZERO` (Task 2).
- Produces:
  - `keysToVector(keys: ReadonlySet<string>): Vec2`; `class Keyboard` with `keys`, `press(code)`, `release(code)`, `clear()`, `attach(win: Window): () => void`
  - `joystickVector(dx, dy, radius, deadZone): Vec2`; `class TouchJoystick(radiusCss?: number)` with `vector: Vec2`, `attach(surface: HTMLElement, base: HTMLElement, knob: HTMLElement): () => void`
  - `interface VectorSource { readonly vector: Vec2 }`; `class Input(keyboard: Keyboard, joystick: VectorSource)` with `direction(): Vec2`

- [ ] **Step 1: Write the failing test**

`tests/input/input.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { Input } from '../../src/input/Input';
import { Keyboard, keysToVector } from '../../src/input/keyboard';
import { joystickVector } from '../../src/input/touchJoystick';

describe('keysToVector', () => {
  it('maps WASD and arrows, normalising diagonals', () => {
    expect(keysToVector(new Set(['KeyD']))).toEqual({ x: 1, y: 0 });
    expect(keysToVector(new Set(['ArrowUp']))).toEqual({ x: 0, y: -1 });
    const diag = keysToVector(new Set(['KeyW', 'KeyA']));
    expect(Math.hypot(diag.x, diag.y)).toBeCloseTo(1);
    expect(diag.x).toBeLessThan(0);
    expect(diag.y).toBeLessThan(0);
  });

  it('cancels opposite keys', () => {
    expect(keysToVector(new Set(['KeyA', 'KeyD']))).toEqual({ x: 0, y: 0 });
  });
});

describe('Keyboard', () => {
  it('clear() releases held keys (window blur)', () => {
    const kb = new Keyboard();
    kb.press('KeyW');
    kb.clear();
    expect(keysToVector(kb.keys)).toEqual({ x: 0, y: 0 });
  });
});

describe('joystickVector', () => {
  it('returns zero inside the dead zone', () => {
    expect(joystickVector(3, 0, 50, 0.1)).toEqual({ x: 0, y: 0 });
  });

  it('scales with distance and clamps to length 1', () => {
    expect(joystickVector(25, 0, 50, 0.1).x).toBeCloseTo(0.5);
    const far = joystickVector(300, 400, 50, 0.1);
    expect(Math.hypot(far.x, far.y)).toBeCloseTo(1);
    expect(far.x).toBeCloseTo(0.6);
  });
});

describe('Input', () => {
  it('prefers an active joystick over the keyboard', () => {
    const kb = new Keyboard();
    kb.press('KeyD');
    const joy = { vector: { x: 0, y: 0 } };
    const input = new Input(kb, joy);
    expect(input.direction()).toEqual({ x: 1, y: 0 });
    joy.vector = { x: 0, y: 1 };
    expect(input.direction()).toEqual({ x: 0, y: 1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/input`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`src/input/keyboard.ts`:
```ts
import { normalize, type Vec2 } from '../core/vec';

const LEFT = ['KeyA', 'ArrowLeft'];
const RIGHT = ['KeyD', 'ArrowRight'];
const UP = ['KeyW', 'ArrowUp'];
const DOWN = ['KeyS', 'ArrowDown'];
const MOVE_CODES = new Set([...LEFT, ...RIGHT, ...UP, ...DOWN]);

/** Uses KeyboardEvent.code (physical key position), so WASD works on any layout. */
export function keysToVector(keys: ReadonlySet<string>): Vec2 {
  const any = (codes: string[]) => codes.some((c) => keys.has(c));
  const x = (any(RIGHT) ? 1 : 0) - (any(LEFT) ? 1 : 0);
  const y = (any(DOWN) ? 1 : 0) - (any(UP) ? 1 : 0);
  return normalize({ x, y });
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
  );
}

export class Keyboard {
  readonly keys = new Set<string>();

  press(code: string): void {
    this.keys.add(code);
  }

  release(code: string): void {
    this.keys.delete(code);
  }

  clear(): void {
    this.keys.clear();
  }

  attach(win: Window): () => void {
    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (MOVE_CODES.has(e.code)) e.preventDefault();
      this.press(e.code);
    };
    const up = (e: KeyboardEvent) => this.release(e.code);
    const blur = () => this.clear();
    win.addEventListener('keydown', down);
    win.addEventListener('keyup', up);
    win.addEventListener('blur', blur);
    return () => {
      win.removeEventListener('keydown', down);
      win.removeEventListener('keyup', up);
      win.removeEventListener('blur', blur);
    };
  }
}
```

`src/input/touchJoystick.ts`:
```ts
import type { Vec2 } from '../core/vec';

const DEAD_ZONE = 0.1;
/** Touches starting in the left 60% of the surface control the joystick. */
const ACTIVE_FRACTION = 0.6;

export function joystickVector(dx: number, dy: number, radius: number, deadZone: number): Vec2 {
  const len = Math.hypot(dx, dy);
  if (len < deadZone * radius) return { x: 0, y: 0 };
  const m = Math.min(len, radius) / radius;
  return { x: (dx / len) * m, y: (dy / len) * m };
}

/** Floating joystick: appears where the thumb lands, follows until release. */
export class TouchJoystick {
  vector: Vec2 = { x: 0, y: 0 };
  private pointerId: number | null = null;
  private originX = 0;
  private originY = 0;

  constructor(private readonly radiusCss = 56) {}

  attach(surface: HTMLElement, base: HTMLElement, knob: HTMLElement): () => void {
    const place = (el: HTMLElement, x: number, y: number) => {
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    };
    const reset = () => {
      this.pointerId = null;
      this.vector = { x: 0, y: 0 };
      base.hidden = true;
      knob.hidden = true;
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || this.pointerId !== null) return;
      if (e.clientX > surface.clientWidth * ACTIVE_FRACTION) return;
      this.pointerId = e.pointerId;
      this.originX = e.clientX;
      this.originY = e.clientY;
      surface.setPointerCapture(e.pointerId);
      place(base, e.clientX, e.clientY);
      place(knob, e.clientX, e.clientY);
      base.hidden = false;
      knob.hidden = false;
      e.preventDefault();
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== this.pointerId) return;
      const dx = e.clientX - this.originX;
      const dy = e.clientY - this.originY;
      this.vector = joystickVector(dx, dy, this.radiusCss, DEAD_ZONE);
      const len = Math.hypot(dx, dy);
      const k = len > this.radiusCss ? this.radiusCss / len : 1;
      place(knob, this.originX + dx * k, this.originY + dy * k);
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId === this.pointerId) reset();
    };
    surface.addEventListener('pointerdown', down);
    surface.addEventListener('pointermove', move);
    surface.addEventListener('pointerup', up);
    surface.addEventListener('pointercancel', up);
    reset();
    return () => {
      surface.removeEventListener('pointerdown', down);
      surface.removeEventListener('pointermove', move);
      surface.removeEventListener('pointerup', up);
      surface.removeEventListener('pointercancel', up);
    };
  }
}
```

`src/input/Input.ts`:
```ts
import type { Vec2 } from '../core/vec';
import { keysToVector, type Keyboard } from './keyboard';

export interface VectorSource {
  readonly vector: Vec2;
}

export class Input {
  constructor(
    private readonly keyboard: Keyboard,
    private readonly joystick: VectorSource,
  ) {}

  /** Movement direction with length <= 1. The joystick wins while it is deflected. */
  direction(): Vec2 {
    const j = this.joystick.vector;
    if (j.x !== 0 || j.y !== 0) return j;
    return keysToVector(this.keyboard.keys);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/input`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run format && npm run lint
git add src/input tests/input
git commit -m "feat(input): keyboard, floating touch joystick and combined input"
```

---

### Task 12: Rendering — colours, camera, sprites, chunk baking, renderer

**Files:**
- Create: `src/render/color.ts`, `src/render/camera.ts`, `src/render/sprites.ts`, `src/render/chunkBaker.ts`, `src/render/BakeCache.ts`, `src/render/Renderer.ts`
- Test: `tests/render/render.test.ts`

**Interfaces:**
- Consumes: `World`, `ChunkData`, chunk helpers, `SALT` (Tasks 5–6); data tables (Task 3); `Player` (Task 7); `isTired` (Task 7); `LruCache` (Task 2); `hash2` (Task 2).
- Produces:
  - `type RGB = [number, number, number]`, `parseHex(hex): RGB`, `shade(rgb, factor): RGB`
  - `computeZoom(deviceShortSide: number): number`; `class Camera` with `x`, `y`, `snap(x, y)`, `follow(x, y, dt)`
  - `interface PixelSprite { w; h; palette: Record<string, string>; rows: readonly string[] }`, `spriteErrors(s): string[]`, `spriteToCanvas(s): HTMLCanvasElement`, `GIZMO_FRAMES: readonly PixelSprite[]`, `GIZMO_TIRED: PixelSprite`, `ITEM_SPRITES: Record<ItemKey, PixelSprite>`
  - `type CanvasLike = OffscreenCanvas | HTMLCanvasElement`, `SHADE_VARIATION = 0.04`, `fillChunkPixels(chunk, seed, out: Uint8ClampedArray)`, `bakeChunk(chunk, seed): CanvasLike`
  - `class BakeCache(bake: (c: ChunkData) => CanvasLike, limit?, perFrame?)` with `beginFrame()`, `get(chunk): CanvasLike | undefined`, `size`, `bakesThisFrame`
  - `interface Flyer { itemId; fromX; fromY; t }`, `interface RenderState { player; camera; flyers; time; debugTint }`, `class Renderer(canvas)` with `zoom`, `setWorld(world)`, `resize(cssW, cssH, dpr)`, `render(state)`, `stats(): { bakedCanvases: number; bakesThisFrame: number }`

- [ ] **Step 1: Write the failing test**

`tests/render/render.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { CHUNK_PX, TILE_PX } from '../../src/config';
import { BLOCKS, BLOCK_ID } from '../../src/data/blocks';
import { ITEM_KEYS } from '../../src/data/items';
import { TERRAINS, TERRAIN_INDEX } from '../../src/data/terrains';
import { BakeCache } from '../../src/render/BakeCache';
import { Camera, computeZoom } from '../../src/render/camera';
import { fillChunkPixels, type CanvasLike } from '../../src/render/chunkBaker';
import { parseHex, shade } from '../../src/render/color';
import { GIZMO_FRAMES, GIZMO_TIRED, ITEM_SPRITES, spriteErrors } from '../../src/render/sprites';
import { createChunkData, localIndex } from '../../src/world/chunk';

describe('color', () => {
  it('parses short and long hex', () => {
    expect(parseHex('#fff')).toEqual([255, 255, 255]);
    expect(parseHex('#4fa836')).toEqual([0x4f, 0xa8, 0x36]);
  });

  it('shades and clamps', () => {
    expect(shade([100, 200, 250], 0.5)).toEqual([50, 100, 125]);
    expect(shade([200, 200, 200], 2)).toEqual([255, 255, 255]);
  });
});

describe('camera', () => {
  it('chooses an integer zoom showing at least 14 tiles on the short side', () => {
    expect(computeZoom(1080)).toBe(4);
    expect(computeZoom(1170)).toBe(5);
    expect(computeZoom(300)).toBe(2);
    for (const side of [720, 900, 1080, 1440, 2160]) {
      expect(side / (TILE_PX * computeZoom(side))).toBeGreaterThanOrEqual(14);
    }
  });

  it('follows its target smoothly and converges', () => {
    const c = new Camera();
    c.follow(100, 50, 1 / 60);
    expect(c.x).toBeGreaterThan(0);
    expect(c.x).toBeLessThan(100);
    for (let i = 0; i < 300; i++) c.follow(100, 50, 1 / 60);
    expect(c.x).toBeCloseTo(100, 1);
    expect(c.y).toBeCloseTo(50, 1);
  });
});

describe('sprites', () => {
  it('are well-formed', () => {
    for (const s of [...GIZMO_FRAMES, GIZMO_TIRED]) expect(spriteErrors(s)).toEqual([]);
    for (const key of ITEM_KEYS) expect(spriteErrors(ITEM_SPRITES[key]), key).toEqual([]);
  });
});

describe('fillChunkPixels', () => {
  it('paints terrain with slight shade variation and blocks with their colour', () => {
    const chunk = createChunkData(0, 0);
    chunk.terrain.fill(TERRAIN_INDEX.grass);
    chunk.block[localIndex(1, 1)] = BLOCK_ID.boulder;
    const out = new Uint8ClampedArray(CHUNK_PX * CHUNK_PX * 4);
    fillChunkPixels(chunk, 42, out);

    const grass = parseHex(TERRAINS[TERRAIN_INDEX.grass].color);
    for (let c = 0; c < 3; c++) {
      expect(Math.abs(out[c] - grass[c])).toBeLessThanOrEqual(Math.ceil(grass[c] * 0.04) + 1);
    }
    const boulder = parseHex(BLOCKS[BLOCK_ID.boulder - 1].color);
    const o = ((TILE_PX + 8) * CHUNK_PX + TILE_PX + 8) * 4;
    expect([out[o], out[o + 1], out[o + 2]]).toEqual(boulder);
    for (let i = 3; i < out.length; i += 4) {
      if (out[i] !== 255) throw new Error(`alpha ${out[i]} at ${i}`);
    }
  });
});

describe('BakeCache', () => {
  it('respects the per-frame budget and serves cache hits for free', () => {
    let bakes = 0;
    const cache = new BakeCache(() => {
      bakes++;
      return {} as CanvasLike;
    }, 32, 2);
    const chunks = [0, 1, 2].map((i) => createChunkData(i, 0));
    cache.beginFrame();
    expect(cache.get(chunks[0])).toBeDefined();
    expect(cache.get(chunks[1])).toBeDefined();
    expect(cache.get(chunks[2])).toBeUndefined();
    expect(cache.get(chunks[0])).toBeDefined();
    expect(bakes).toBe(2);
    expect(cache.bakesThisFrame).toBe(2);
    cache.beginFrame();
    expect(cache.get(chunks[2])).toBeDefined();
    expect(bakes).toBe(3);
  });

  it('evicts least recently used canvases', () => {
    const cache = new BakeCache(() => ({}) as CanvasLike, 2, 10);
    cache.beginFrame();
    for (let i = 0; i < 3; i++) cache.get(createChunkData(i, 0));
    expect(cache.size).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement colour, camera and sprites**

`src/render/color.ts`:
```ts
export type RGB = [number, number, number];

export function parseHex(hex: string): RGB {
  let h = hex.replace(/^#/, '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

export function shade(rgb: RGB, factor: number): RGB {
  const f = (v: number) => Math.min(255, Math.max(0, Math.round(v * factor)));
  return [f(rgb[0]), f(rgb[1]), f(rgb[2])];
}
```

`src/render/camera.ts`:
```ts
import { CAMERA_STIFFNESS, MIN_ZOOM, TARGET_TILES_SHORT_SIDE, TILE_PX } from '../config';

/** Largest integer zoom that still shows TARGET_TILES_SHORT_SIDE tiles (min MIN_ZOOM). */
export function computeZoom(deviceShortSide: number): number {
  return Math.max(MIN_ZOOM, Math.floor(deviceShortSide / (TILE_PX * TARGET_TILES_SHORT_SIDE)));
}

export class Camera {
  x = 0;
  y = 0;

  snap(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  /** Frame-rate independent exponential follow. */
  follow(x: number, y: number, dt: number): void {
    const k = 1 - Math.exp(-CAMERA_STIFFNESS * dt);
    this.x += (x - this.x) * k;
    this.y += (y - this.y) * k;
  }
}
```

`src/render/sprites.ts`:
```ts
import type { ItemKey } from '../data/items';

/** A pixel sprite: each char in `rows` is a palette key, '.' is transparent. */
export interface PixelSprite {
  w: number;
  h: number;
  palette: Record<string, string>;
  rows: readonly string[];
}

export function spriteErrors(s: PixelSprite): string[] {
  const errors: string[] = [];
  if (s.rows.length !== s.h) errors.push(`expected ${s.h} rows, got ${s.rows.length}`);
  s.rows.forEach((row, i) => {
    if (row.length !== s.w) errors.push(`row ${i} has ${row.length} columns`);
    for (const ch of row) {
      if (ch !== '.' && !(ch in s.palette)) errors.push(`row ${i}: unknown '${ch}'`);
    }
  });
  return errors;
}

export function spriteToCanvas(s: PixelSprite): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = s.w;
  canvas.height = s.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  s.rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      ctx.fillStyle = s.palette[ch];
      ctx.fillRect(x, y, 1, 1);
    });
  });
  return canvas;
}

const GIZMO_PALETTE = {
  k: '#1d2b2a',
  g: '#5fd16b',
  G: '#3a9c4a',
  w: '#ffffff',
  e: '#1d2b2a',
  a: '#ffd23f',
  c: '#ff8fa3',
};

const GIZMO_TOP = [
  '.......aa.......',
  '.......kk.......',
  '....kkkkkkkk....',
  '...kggggggggk...',
  '..kggggggggggk..',
];
const GIZMO_EYES_OPEN = ['..kgwwggggwwgk..', '..kgweggggewgk..'];
const GIZMO_EYES_SHUT = ['..kggggggggggk..', '..kgkkggggkkgk..'];
const GIZMO_BODY = [
  '..kggggggggggk..',
  '..kgcggkkggcgk..',
  '..kggggggggggk..',
  '...kGGGGGGGGk...',
  '....kkkkkkkk....',
];
const LEGS_TOGETHER = ['.....kG..Gk.....', '.....kk..kk.....'];
const LEGS_APART = ['....kG....Gk....', '....kk....kk....'];
const BLANK = ['................', '................'];

const gizmo = (eyes: string[], legs: string[]): PixelSprite => ({
  w: 16,
  h: 16,
  palette: GIZMO_PALETTE,
  rows: [...GIZMO_TOP, ...eyes, ...GIZMO_BODY, ...legs, ...BLANK],
});

/** Feet (last leg row) are row 13; draw with the sprite's row 14 at the player's y. */
export const GIZMO_FEET_ROW = 13;
export const GIZMO_FRAMES: readonly PixelSprite[] = [
  gizmo(GIZMO_EYES_OPEN, LEGS_TOGETHER),
  gizmo(GIZMO_EYES_OPEN, LEGS_APART),
];
export const GIZMO_TIRED: PixelSprite = gizmo(GIZMO_EYES_SHUT, LEGS_TOGETHER);

const BERRY_ROWS = [
  '...ll...',
  '...l....',
  '..rrrr..',
  '.rhrrrr.',
  '.rrrrrr.',
  '.rrrrrd.',
  '..rddd..',
  '........',
];

const berry = (r: string, d: string, h: string): PixelSprite => ({
  w: 8,
  h: 8,
  palette: { l: '#3fa34d', r, d, h },
  rows: BERRY_ROWS,
});

export const ITEM_SPRITES: Record<ItemKey, PixelSprite> = {
  berry: berry('#e5484d', '#a3242a', '#ffb3b5'),
  golden: berry('#f5b82e', '#b07a12', '#fff1b8'),
  sour: berry('#9bd13b', '#5e8a1c', '#e2f7b5'),
  zoom: {
    w: 8,
    h: 8,
    palette: { l: '#3fd0c9', d: '#1e8f8a' },
    rows: ['......l.', '.....ll.', '...llll.', '..lllld.', '.llldd..', '.lldd...', '.dd.....', 'd.......'],
  },
  magnet: {
    w: 8,
    h: 8,
    palette: { p: '#b46ee8', q: '#7d3fb3', y: '#ffe066' },
    rows: ['...pp...', '..pqqp..', '.ppyypp.', 'pqyyyyqp', 'pqyyyyqp', '.ppyypp.', '..pqqp..', '...pp...'],
  },
  sap: {
    w: 8,
    h: 8,
    palette: { a: '#d98a1c', b: '#a35f08', h: '#ffd28a' },
    rows: ['...a....', '...a....', '..aaa...', '.aahaa..', '.ahaaa..', '.aaaab..', '..abb...', '........'],
  },
};
```

- [ ] **Step 4: Implement chunk baking and the bake cache**

`src/render/chunkBaker.ts`:
```ts
import { CHUNK_PX, CHUNK_SIZE, TILE_PX } from '../config';
import { hash2 } from '../core/rng';
import { BLOCKS, blockById } from '../data/blocks';
import { TERRAINS } from '../data/terrains';
import { localIndex, type ChunkData } from '../world/chunk';
import { SALT } from '../world/generator';
import { parseHex, shade, type RGB } from './color';

export type CanvasLike = OffscreenCanvas | HTMLCanvasElement;

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
          if (block && px >= 1 && px <= 14 && py >= 1 && py <= 14) {
            const edge = px === 1 || px === 14 || py === 1 || py === 14;
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
```

`src/render/BakeCache.ts`:
```ts
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/render`
Expected: PASS.

- [ ] **Step 6: Implement the renderer**

`src/render/Renderer.ts`:
```ts
import { CHUNK_PX, PREFETCH_GENERATIONS_PER_FRAME, TILE_PX } from '../config';
import { BIOMES } from '../data/biomes';
import { ITEMS, NO_ITEM } from '../data/items';
import type { Player } from '../entities/Player';
import { isTired } from '../systems/energy';
import type { World } from '../world/World';
import { BakeCache } from './BakeCache';
import { computeZoom, type Camera } from './camera';
import { bakeChunk, type CanvasLike } from './chunkBaker';
import { GIZMO_FEET_ROW, GIZMO_FRAMES, GIZMO_TIRED, ITEM_SPRITES, spriteToCanvas } from './sprites';

/** An item flying towards Gizmo after a magnet pickup. t goes 0 → 1. */
export interface Flyer {
  itemId: number;
  fromX: number;
  fromY: number;
  t: number;
}

export interface RenderState {
  player: Player;
  camera: Camera;
  flyers: readonly Flyer[];
  time: number;
  debugTint: boolean;
}

const BACKGROUND = '#1b1f24';
const UNBAKED = '#2a3b2f';

export class Renderer {
  zoom = 2;
  private readonly ctx: CanvasRenderingContext2D;
  private world: World | null = null;
  private bakes: BakeCache | null = null;
  private readonly gizmo = GIZMO_FRAMES.map(spriteToCanvas);
  private readonly gizmoTired = spriteToCanvas(GIZMO_TIRED);
  private readonly itemCanvases = new Map<number, CanvasLike>(
    ITEMS.map((it) => [it.id, spriteToCanvas(ITEM_SPRITES[it.key])]),
  );

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
  }

  setWorld(world: World): void {
    this.world = world;
    this.bakes = new BakeCache((chunk) => bakeChunk(chunk, world.seed));
  }

  resize(cssW: number, cssH: number, dpr: number): void {
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.zoom = computeZoom(Math.min(this.canvas.width, this.canvas.height));
  }

  stats(): { bakedCanvases: number; bakesThisFrame: number } {
    return { bakedCanvases: this.bakes?.size ?? 0, bakesThisFrame: this.bakes?.bakesThisFrame ?? 0 };
  }

  render(s: RenderState): void {
    const { ctx, canvas, zoom: z, world, bakes } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!world || !bakes) return;
    bakes.beginFrame();

    // Snap the camera to whole texture pixels so nothing shimmers.
    const camX = Math.round(s.camera.x);
    const camY = Math.round(s.camera.y);
    ctx.setTransform(z, 0, 0, z, Math.floor(canvas.width / 2) - camX * z, Math.floor(canvas.height / 2) - camY * z);
    ctx.imageSmoothingEnabled = false;

    const halfW = canvas.width / 2 / z;
    const halfH = canvas.height / 2 / z;
    const left = camX - halfW;
    const top = camY - halfH;
    const right = camX + halfW;
    const bottom = camY + halfH;

    // Visible chunks.
    const cx0 = Math.floor(left / CHUNK_PX);
    const cx1 = Math.floor(right / CHUNK_PX);
    const cy0 = Math.floor(top / CHUNK_PX);
    const cy1 = Math.floor(bottom / CHUNK_PX);
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const img = bakes.get(world.getChunk(cx, cy));
        if (img) {
          ctx.drawImage(img, cx * CHUNK_PX, cy * CHUNK_PX);
        } else {
          ctx.fillStyle = UNBAKED;
          ctx.fillRect(cx * CHUNK_PX, cy * CHUNK_PX, CHUNK_PX, CHUNK_PX);
        }
      }
    }

    // Prefetch one ring beyond the viewport, within the generation and bake budgets.
    let generations = PREFETCH_GENERATIONS_PER_FRAME;
    for (let cy = cy0 - 1; cy <= cy1 + 1; cy++) {
      for (let cx = cx0 - 1; cx <= cx1 + 1; cx++) {
        if (cx >= cx0 && cx <= cx1 && cy >= cy0 && cy <= cy1) continue;
        if (!world.hasChunk(cx, cy)) {
          if (generations <= 0) continue;
          generations--;
        }
        bakes.get(world.getChunk(cx, cy));
      }
    }

    // Items (bobbing 1 px, phase-shifted per tile).
    const tx0 = Math.floor(left / TILE_PX);
    const tx1 = Math.floor(right / TILE_PX);
    const ty0 = Math.floor(top / TILE_PX);
    const ty1 = Math.floor(bottom / TILE_PX);
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const id = world.itemAt(tx, ty);
        if (id === NO_ITEM) continue;
        const img = this.itemCanvases.get(id);
        if (!img) continue;
        const bob = Math.round(Math.sin(s.time * 3 * Math.PI + tx * 7 + ty * 13));
        ctx.drawImage(img, tx * TILE_PX + 4, ty * TILE_PX + 4 + bob);
      }
    }

    if (s.debugTint) {
      ctx.globalAlpha = 0.35;
      for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          ctx.fillStyle = BIOMES[world.biomeAt(tx, ty)].tint;
          ctx.fillRect(tx * TILE_PX, ty * TILE_PX, TILE_PX, TILE_PX);
        }
      }
      ctx.globalAlpha = 1;
    }

    // Magnet flyers.
    const p = s.player;
    for (const f of s.flyers) {
      const img = this.itemCanvases.get(f.itemId);
      if (!img) continue;
      const e = f.t * f.t;
      const x = f.fromX + (p.x - f.fromX) * e;
      const y = f.fromY + (p.y - 8 - f.fromY) * e;
      ctx.drawImage(img, Math.round(x - 4), Math.round(y - 4));
    }

    // Gizmo: feet row sits on p.y.
    const frame = isTired(p)
      ? this.gizmoTired
      : this.gizmo[p.moving ? Math.floor(p.animTime * 6) % this.gizmo.length : 0];
    const gx = Math.round(p.x) - 8;
    const gy = Math.round(p.y) - (GIZMO_FEET_ROW + 1);
    if (p.facing === -1) {
      ctx.save();
      ctx.translate(gx + 16, gy);
      ctx.scale(-1, 1);
      ctx.drawImage(frame, 0, 0);
      ctx.restore();
    } else {
      ctx.drawImage(frame, gx, gy);
    }
  }
}
```

- [ ] **Step 7: Typecheck, lint and test**

Run: `npm run format && npx tsc --noEmit && npm run lint && npm test`
Expected: no type errors; all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/render tests/render
git commit -m "feat(render): pixel sprites, chunk baking with budget, integer-zoom renderer"
```

---

### Task 13: HUD, menu, debug overlay, Game and bootstrap

**Files:**
- Create: `src/ui/hud.ts`, `src/ui/menu.ts`, `src/ui/debugOverlay.ts`, `src/save/fileio.ts`, `src/seedWords.ts`, `src/Game.ts`, `src/style.css`
- Modify: `index.html` (replace entirely), `src/main.ts` (replace entirely)
- Test: `tests/seedWords.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces:
  - `randomSeedText(rand?: () => number): string`
  - `class Hud(doc: Document)` with `update(p)`, `toast(title, subtitle?)`, `notice(text, seconds?)`
  - `class Menu(doc, handlers: MenuHandlers, info: { storageAvailable: boolean })` with `isOpen`, `setSeed(seed)`
  - `class DebugOverlay(el: HTMLElement, visible: boolean)` with `visible`, `toggle()`, `update(lines: Record<string, string | number>)`
  - `downloadSave(data)`, `readSaveFile(file): Promise<SaveData>`
  - `class Game(renderer, hud, input)` with `world`, `player`, `debugTint`, `newWorld(seedText)`, `load(data)`, `update(dt)`, `render()`, `toSaveData()`

- [ ] **Step 1: Write the failing test**

`tests/seedWords.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/rng';
import { randomSeedText } from '../src/seedWords';

describe('randomSeedText', () => {
  it('produces readable adjective-noun-number seeds', () => {
    const r = mulberry32(1);
    for (let i = 0; i < 50; i++) expect(randomSeedText(r)).toMatch(/^[a-z]+-[a-z]+-\d{1,2}$/);
  });

  it('is deterministic for a given random source', () => {
    expect(randomSeedText(mulberry32(9))).toBe(randomSeedText(mulberry32(9)));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/seedWords.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/seedWords.ts`**

```ts
const ADJECTIVES = [
  'maple', 'mossy', 'sunny', 'misty', 'amber', 'cozy', 'breezy', 'dusky', 'frosty', 'golden',
  'hazel', 'lucky', 'mellow', 'pebble', 'quiet', 'rusty', 'sandy', 'tiny', 'velvet', 'windy',
];
const NOUNS = [
  'meadow', 'brook', 'hollow', 'grove', 'dune', 'fjord', 'glade', 'heath', 'isle', 'knoll',
  'marsh', 'orchard', 'ridge', 'thicket', 'vale',
];

function pick<T>(arr: readonly T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

/** A memorable seed such as "mossy-glade-42". Uses Math.random by default (not generation). */
export function randomSeedText(rand: () => number = Math.random): string {
  return `${pick(ADJECTIVES, rand)}-${pick(NOUNS, rand)}-${Math.floor(rand() * 100)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/seedWords.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement UI modules and save file I/O**

`src/ui/hud.ts`:
```ts
import { MAX_ENERGY } from '../config';
import type { EffectKind } from '../data/items';
import type { Player } from '../entities/Player';
import { isTired } from '../systems/energy';

const EFFECT_LABEL: Record<EffectKind, string> = {
  zoom: 'Zoom',
  magnet: 'Magnet',
  sap: 'Sticky',
  wobble: 'Wobbly',
};

function el(doc: Document, id: string): HTMLElement {
  const e = doc.getElementById(id);
  if (!e) throw new Error(`Missing #${id} in index.html`);
  return e;
}

export class Hud {
  private readonly energyFill: HTMLElement;
  private readonly treasures: HTMLElement;
  private readonly effects: HTMLElement;
  private readonly tired: HTMLElement;
  private readonly toastEl: HTMLElement;
  private readonly toastTitle: HTMLElement;
  private readonly toastSub: HTMLElement;
  private readonly noticeEl: HTMLElement;
  private noticeTimer: number | undefined;
  private last = { energy: '', treasures: '', effects: '', tired: false };

  constructor(doc: Document) {
    this.energyFill = el(doc, 'energy-fill');
    this.treasures = el(doc, 'treasures');
    this.effects = el(doc, 'effects');
    this.tired = el(doc, 'tired-hint');
    this.toastEl = el(doc, 'toast');
    this.toastTitle = el(doc, 'toast-title');
    this.toastSub = el(doc, 'toast-sub');
    this.noticeEl = el(doc, 'notice');
  }

  /** Called every frame; only touches the DOM when something changed. */
  update(p: Player): void {
    const energy = `${Math.round((p.energy / MAX_ENERGY) * 100)}%`;
    const treasures = `Treasures: ${p.treasures}`;
    const effects = p.effects
      .filter((e) => e.kind !== 'wobble')
      .map((e) => `${EFFECT_LABEL[e.kind]} ${Math.ceil(e.remaining)}s`)
      .join(' · ');
    const tired = isTired(p);
    if (energy !== this.last.energy) this.energyFill.style.width = energy;
    if (treasures !== this.last.treasures) this.treasures.textContent = treasures;
    if (effects !== this.last.effects) this.effects.textContent = effects;
    if (tired !== this.last.tired) this.tired.hidden = !tired;
    this.last = { energy, treasures, effects, tired };
  }

  toast(title: string, subtitle = ''): void {
    this.toastTitle.textContent = title;
    this.toastSub.textContent = subtitle;
    this.toastEl.classList.remove('show');
    void this.toastEl.offsetWidth; // restart the CSS animation
    this.toastEl.classList.add('show');
  }

  notice(text: string, seconds = 6): void {
    this.noticeEl.textContent = text;
    this.noticeEl.hidden = false;
    window.clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => (this.noticeEl.hidden = true), seconds * 1000);
  }
}
```

`src/ui/menu.ts`:
```ts
export interface MenuHandlers {
  onOpen(): void;
  onClose(): void;
  newWorld(seedText: string): void;
  exportSave(): void;
  importSave(file: File): void;
}

function el<T extends HTMLElement>(doc: Document, id: string): T {
  const e = doc.getElementById(id);
  if (!e) throw new Error(`Missing #${id} in index.html`);
  return e as T;
}

export class Menu {
  private readonly dialog: HTMLDialogElement;
  private readonly seedLabel: HTMLElement;

  constructor(doc: Document, handlers: MenuHandlers, info: { storageAvailable: boolean }) {
    this.dialog = el<HTMLDialogElement>(doc, 'menu');
    this.seedLabel = el(doc, 'menu-seed');
    const seedInput = el<HTMLInputElement>(doc, 'seed-input');
    const importInput = el<HTMLInputElement>(doc, 'import-save');
    el(doc, 'storage-warning').hidden = info.storageAvailable;

    el(doc, 'menu-button').addEventListener('click', () => {
      this.dialog.showModal();
      handlers.onOpen();
    });
    el(doc, 'close-menu').addEventListener('click', () => this.dialog.close());
    this.dialog.addEventListener('close', () => handlers.onClose());

    el(doc, 'new-world').addEventListener('click', () => {
      if (!window.confirm('Start a new world? Your current world will be replaced.')) return;
      handlers.newWorld(seedInput.value.trim());
      seedInput.value = '';
      this.dialog.close();
    });
    el(doc, 'export-save').addEventListener('click', () => handlers.exportSave());
    importInput.addEventListener('change', () => {
      const file = importInput.files?.[0];
      importInput.value = '';
      if (file) {
        handlers.importSave(file);
        this.dialog.close();
      }
    });
  }

  get isOpen(): boolean {
    return this.dialog.open;
  }

  setSeed(seed: string): void {
    this.seedLabel.textContent = `Current world: ${seed}`;
  }
}
```

`src/ui/debugOverlay.ts`:
```ts
const REFRESH_MS = 250;

export class DebugOverlay {
  private lastUpdate = 0;

  constructor(
    private readonly el: HTMLElement,
    public visible: boolean,
  ) {
    el.hidden = !visible;
  }

  toggle(): void {
    this.visible = !this.visible;
    this.el.hidden = !this.visible;
  }

  /** Throttled to avoid layout work every frame. */
  update(lines: Record<string, string | number>): void {
    if (!this.visible) return;
    const now = performance.now();
    if (now - this.lastUpdate < REFRESH_MS) return;
    this.lastUpdate = now;
    this.el.textContent = Object.entries(lines)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
  }
}
```

`src/save/fileio.ts`:
```ts
import { parseSave, type SaveData } from './storage';

export function downloadSave(data: SaveData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gizmo-save-${data.seed.replace(/[^a-z0-9_-]/gi, '_')}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Throws SaveError for anything that isn't a valid current-version save. */
export async function readSaveFile(file: File): Promise<SaveData> {
  return parseSave(await file.text());
}
```

- [ ] **Step 6: Implement `src/Game.ts`**

```ts
import { MAX_ENERGY, TILE_PX } from './config';
import { BIOMES } from './data/biomes';
import { TERRAINS } from './data/terrains';
import { Player } from './entities/Player';
import type { Input } from './input/Input';
import { Camera } from './render/camera';
import type { Flyer, Renderer } from './render/Renderer';
import type { SaveData } from './save/storage';
import { createDiscoveryState, updateDiscovery, type DiscoveryState } from './systems/discovery';
import { tickEffects } from './systems/effects';
import { tickEnergy } from './systems/energy';
import { unstick, updateMovement, type MovementEnv } from './systems/movement';
import { collectItems } from './systems/pickups';
import type { Hud } from './ui/hud';
import { World } from './world/World';

/** Camera looks slightly above the feet so Gizmo appears centred. */
const CAMERA_OFFSET_Y = 6;
const FLYER_SECONDS = 0.3;

export class Game {
  world!: World;
  player = new Player();
  readonly camera = new Camera();
  discovery: DiscoveryState = createDiscoveryState();
  flyers: Flyer[] = [];
  time = 0;
  debugTint = false;
  private env!: MovementEnv;

  constructor(
    private readonly renderer: Renderer,
    private readonly hud: Hud,
    private readonly input: Input,
  ) {}

  newWorld(seedText: string): void {
    this.world = new World(seedText);
    this.player = new Player();
    const spawn = this.world.findSpawn();
    this.player.placeAtTile(spawn.tx, spawn.ty);
    this.discovery = createDiscoveryState();
    this.afterWorldChange();
  }

  load(data: SaveData): void {
    this.world = new World(data.seed, data.chunkDiffs);
    const p = new Player();
    p.x = data.player.x;
    p.y = data.player.y;
    p.energy = Math.min(MAX_ENERGY, Math.max(0, data.player.energy));
    p.treasures = Math.max(0, Math.floor(data.player.treasures));
    p.effects = data.player.effects.map((e) => ({ ...e }));
    this.player = p;
    unstick(p, this.world);
    this.discovery = createDiscoveryState(data.discoveredBiomes);
    this.afterWorldChange();
  }

  private afterWorldChange(): void {
    const world = this.world;
    this.env = {
      isSolid: (tx, ty) => world.isSolid(tx, ty),
      terrainAt: (tx, ty) => TERRAINS[world.terrainAt(tx, ty)],
    };
    this.flyers = [];
    this.renderer.setWorld(world);
    this.camera.snap(this.player.x, this.player.y - CAMERA_OFFSET_Y);
  }

  update(dt: number): void {
    const p = this.player;
    updateMovement(p, this.input.direction(), dt, this.env);
    tickEffects(p.effects, dt);

    const biome = this.world.biomeAt(p.tileX(), p.tileY());
    tickEnergy(p, dt, BIOMES[biome].effect);

    for (const ev of collectItems(p, this.world)) {
      if (ev.magnet) {
        this.flyers.push({
          itemId: ev.itemId,
          fromX: ev.tx * TILE_PX + TILE_PX / 2,
          fromY: ev.ty * TILE_PX + TILE_PX / 2,
          t: 0,
        });
      }
    }
    for (const f of this.flyers) f.t += dt / FLYER_SECONDS;
    this.flyers = this.flyers.filter((f) => f.t < 1);

    const change = updateDiscovery(this.discovery, biome, dt);
    if (change) {
      this.hud.toast(BIOMES[change.biome].name, change.isNew ? 'New biome discovered!' : '');
    }

    this.camera.follow(p.x, p.y - CAMERA_OFFSET_Y, dt);
    this.time += dt;
  }

  render(): void {
    this.renderer.render({
      player: this.player,
      camera: this.camera,
      flyers: this.flyers,
      time: this.time,
      debugTint: this.debugTint,
    });
    this.hud.update(this.player);
  }

  toSaveData(): SaveData {
    const p = this.player;
    return {
      version: 1,
      seed: this.world.seedText,
      player: {
        x: p.x,
        y: p.y,
        energy: p.energy,
        treasures: p.treasures,
        effects: p.effects.map((e) => ({ ...e })),
      },
      discoveredBiomes: [...this.discovery.discovered],
      chunkDiffs: this.world.exportDiffs(),
    };
  }
}
```

- [ ] **Step 7: Replace `index.html`, add `src/style.css`, replace `src/main.ts`**

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no"
    />
    <meta name="theme-color" content="#1b1f24" />
    <title>Gizmo's World</title>
  </head>
  <body>
    <canvas id="game"></canvas>

    <div id="hud">
      <div class="panel">
        <div id="energy-bar" role="meter" aria-label="Energy">
          <div id="energy-fill"></div>
        </div>
        <div id="treasures">Treasures: 0</div>
        <div id="effects"></div>
        <div id="tired-hint" hidden>Gizmo is tired — find a berry!</div>
      </div>
    </div>

    <button id="menu-button" aria-label="Menu">☰</button>
    <div id="toast"><div id="toast-title"></div><div id="toast-sub"></div></div>
    <div id="notice" class="panel" hidden></div>
    <div id="joy-base" hidden></div>
    <div id="joy-knob" hidden></div>
    <pre id="debug" hidden></pre>

    <dialog id="menu">
      <h2>Gizmo's World</h2>
      <p id="menu-seed"></p>
      <label for="seed-input">World seed</label>
      <input id="seed-input" placeholder="leave empty for random" maxlength="40" />
      <button id="new-world">New world</button>
      <button id="export-save">Export save</button>
      <label class="button" for="import-save">Import save</label>
      <input id="import-save" type="file" accept="application/json,.json" hidden />
      <button id="sound-toggle" disabled>Sound: coming soon</button>
      <p id="storage-warning" hidden>Saving isn't available in this browser mode.</p>
      <button id="close-menu">Close</button>
    </dialog>

    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`src/style.css`:
```css
:root {
  --bg: #1b1f24;
  --panel: rgba(20, 24, 28, 0.72);
  --fg: #f4f1e8;
  --accent: #8fd65a;
  --energy: #f5b82e;
}

* {
  box-sizing: border-box;
}

[hidden] {
  display: none !important;
}

html,
body {
  margin: 0;
  height: 100%;
  overflow: hidden;
  background: var(--bg);
  color: var(--fg);
  font-family: system-ui, sans-serif;
  -webkit-user-select: none;
  user-select: none;
}

#game {
  display: block;
  width: 100vw;
  height: 100dvh;
  touch-action: none;
  image-rendering: pixelated;
}

.panel {
  background: var(--panel);
  border-radius: 8px;
  padding: 6px 10px;
}

#hud {
  position: fixed;
  top: max(12px, env(safe-area-inset-top));
  left: max(12px, env(safe-area-inset-left));
  pointer-events: none;
  font-size: 14px;
  line-height: 1.5;
}

#energy-bar {
  width: 160px;
  height: 10px;
  margin: 2px 0 4px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 5px;
  overflow: hidden;
}

#energy-fill {
  height: 100%;
  width: 100%;
  background: var(--energy);
  transition: width 0.2s;
}

#tired-hint {
  color: var(--energy);
}

#menu-button {
  position: fixed;
  top: max(12px, env(safe-area-inset-top));
  right: max(12px, env(safe-area-inset-right));
  width: 44px;
  height: 44px;
  font-size: 22px;
  border: 0;
  border-radius: 10px;
  background: var(--panel);
  color: var(--fg);
  cursor: pointer;
}

#toast {
  position: fixed;
  top: 22%;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  pointer-events: none;
  opacity: 0;
  text-shadow: 0 2px 6px #000;
}

#toast.show {
  animation: toast 2.6s ease-out forwards;
}

#toast-title {
  font-size: 32px;
  font-weight: 700;
}

#toast-sub {
  font-size: 16px;
  color: var(--accent);
}

@keyframes toast {
  0% {
    opacity: 0;
    transform: translate(-50%, 8px);
  }
  15%,
  75% {
    opacity: 1;
    transform: translate(-50%, 0);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, 0);
  }
}

#notice {
  position: fixed;
  bottom: max(16px, env(safe-area-inset-bottom));
  left: 50%;
  transform: translateX(-50%);
  max-width: calc(100vw - 32px);
  pointer-events: none;
}

#joy-base,
#joy-knob {
  position: fixed;
  border-radius: 50%;
  pointer-events: none;
}

#joy-base {
  width: 112px;
  height: 112px;
  margin: -56px 0 0 -56px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  background: rgba(0, 0, 0, 0.2);
}

#joy-knob {
  width: 48px;
  height: 48px;
  margin: -24px 0 0 -24px;
  background: rgba(255, 255, 255, 0.55);
}

#debug {
  position: fixed;
  bottom: 8px;
  left: 8px;
  margin: 0;
  padding: 6px 8px;
  font: 12px/1.3 ui-monospace, monospace;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 6px;
  pointer-events: none;
}

#menu {
  width: min(360px, calc(100vw - 32px));
  border: 0;
  border-radius: 12px;
  padding: 16px;
  background: #242a31;
  color: var(--fg);
}

#menu::backdrop {
  background: rgba(0, 0, 0, 0.5);
}

#menu h2 {
  margin: 0 0 4px;
}

#menu input,
#menu button,
#menu .button {
  display: block;
  width: 100%;
  min-height: 44px;
  margin: 8px 0;
  font: inherit;
  border-radius: 8px;
}

#menu input {
  padding: 0 10px;
  border: 1px solid #4a525c;
  background: #1b1f24;
  color: var(--fg);
}

#menu button,
#menu .button {
  border: 0;
  background: #3a4450;
  color: var(--fg);
  cursor: pointer;
  text-align: center;
  line-height: 44px;
  padding: 0;
}

#menu button:disabled {
  opacity: 0.5;
  cursor: default;
}

#new-world {
  background: #3f7d3a !important;
}
```

`src/main.ts`:
```ts
import './style.css';
import { AUTOSAVE_SECONDS, MAX_TICKS_PER_FRAME, TICK_DT } from './config';
import { startLoop } from './core/loop';
import { BIOMES } from './data/biomes';
import { Game } from './Game';
import { Input } from './input/Input';
import { Keyboard } from './input/keyboard';
import { TouchJoystick } from './input/touchJoystick';
import { Renderer } from './render/Renderer';
import { downloadSave, readSaveFile } from './save/fileio';
import { getBrowserStore, loadSave, writeSave } from './save/storage';
import { randomSeedText } from './seedWords';
import { DebugOverlay } from './ui/debugOverlay';
import { Hud } from './ui/hud';
import { Menu } from './ui/menu';

function el<T extends HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Missing #${id} in index.html`);
  return e as T;
}

const canvas = el<HTMLCanvasElement>('game');
const store = getBrowserStore();
const hud = new Hud(document);
const keyboard = new Keyboard();
keyboard.attach(window);
const joystick = new TouchJoystick();
joystick.attach(canvas, el('joy-base'), el('joy-knob'));
const renderer = new Renderer(canvas);
const game = new Game(renderer, hud, new Input(keyboard, joystick));
const debug = new DebugOverlay(el('debug'), new URLSearchParams(location.search).has('debug'));

const resize = () => renderer.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio);
window.addEventListener('resize', resize);
resize();

const save = () => {
  if (store && !writeSave(store, game.toSaveData())) {
    hud.notice('Could not save — browser storage is full.');
  }
};

const loaded = store ? loadSave(store) : ({ status: 'empty' } as const);
if (loaded.status === 'ok') {
  game.load(loaded.data);
} else {
  game.newWorld(randomSeedText());
  if (loaded.status === 'corrupt') {
    hud.notice('Your save could not be read. A backup was kept and a new world started.');
  }
}
if (!store) hud.notice("Saving isn't available in this browser mode — progress won't persist.");

let autosave = 0;
let fps = 60;
const loop = startLoop(
  TICK_DT,
  MAX_TICKS_PER_FRAME,
  (dt) => {
    game.update(dt);
    autosave += dt;
    if (autosave >= AUTOSAVE_SECONDS) {
      autosave = 0;
      save();
    }
  },
  (frameSeconds) => {
    game.render();
    if (frameSeconds > 0) fps = fps * 0.9 + (1 / frameSeconds) * 0.1;
    if (debug.visible) {
      const p = game.player;
      const tx = p.tileX();
      const ty = p.tileY();
      const cl = game.world.generator.field.climateAt(tx, ty);
      const r = renderer.stats();
      debug.update({
        fps: fps.toFixed(0),
        seed: game.world.seedText,
        tile: `${tx}, ${ty}`,
        biome: BIOMES[game.world.biomeAt(tx, ty)].name,
        climate: `e ${cl.elevation.toFixed(2)} t ${cl.temperature.toFixed(2)} m ${cl.moisture.toFixed(2)} l ${cl.landmark.toFixed(2)}`,
        chunks: game.world.loadedChunkCount,
        baked: `${r.bakedCanvases} (+${r.bakesThisFrame} this frame)`,
        zoom: renderer.zoom,
        tint: game.debugTint ? 'on (B)' : 'off (B)',
      });
    }
  },
);

const menu = new Menu(
  document,
  {
    onOpen: () => loop.setPaused(true),
    onClose: () => loop.setPaused(false),
    newWorld: (seedText) => {
      game.newWorld(seedText || randomSeedText());
      menu.setSeed(game.world.seedText);
      save();
    },
    exportSave: () => downloadSave(game.toSaveData()),
    importSave: (file) => {
      readSaveFile(file)
        .then((data) => {
          game.load(data);
          menu.setSeed(data.seed);
          save();
          hud.notice('Save imported.');
        })
        .catch(() => hud.notice("That file isn't a valid Gizmo save. Nothing was changed."));
    },
  },
  { storageAvailable: store !== null },
);
menu.setSeed(game.world.seedText);

window.addEventListener('keydown', (e) => {
  if (e.code === 'F3') {
    e.preventDefault();
    debug.toggle();
  } else if (e.code === 'KeyB' && debug.visible) {
    game.debugTint = !game.debugTint;
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    save();
    loop.setPaused(true);
  } else if (!menu.isOpen) {
    loop.setPaused(false);
  }
});
window.addEventListener('pagehide', save);
```

- [ ] **Step 8: Typecheck, lint, test and build**

Run: `npm run format && npm run lint && npm test && npm run build`
Expected: all clean; `dist/` produced.

- [ ] **Step 9: Run it in the browser**

Run: `npm run dev` and open `http://localhost:5173/?debug`.
Check:
- The world renders as crisp pixels with no blur; Gizmo is centred and walks with WASD and the arrow keys.
- A biome toast appears at start ("New biome discovered!").
- Walking across a chunk border (watch the tile coords pass a multiple of 32) shows no seam.
- Items bob; collecting a berry changes energy and treasures; a Zoom leaf shows "Zoom Ns" in the HUD.
- F3 toggles the overlay; B tints biomes; tinted borders match where terrain changes.
- Reloading the page restores position, treasures and collected items.
- Menu → New world with seed `maple-17`, reload, then New world `maple-17` again: identical terrain.
- Menu → Export save downloads a JSON file; Import save restores it; importing any other `.json` shows the error notice and the game is unchanged.

Fix anything that fails before committing.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: playable game — HUD, menu, debug overlay, saves, bootstrap"
```

---

### Task 14: CI deploy, docs, license, legacy removal, final verification

**Files:**
- Create: `.github/workflows/deploy.yml`, `docs/manual-test.md`, `README.md`, `LICENSE`
- Delete: `legacy/` (entire folder, including the Pac-Man sounds)
- Modify: `eslint.config.js` (drop `'legacy'` from ignores), `.prettierignore` (drop `legacy`)

**Interfaces:**
- Consumes: npm scripts from Task 1.
- Produces: the deploy pipeline and documentation.

- [ ] **Step 1: Create the workflow**

`.github/workflows/deploy.yml`:
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [master, main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Create `docs/manual-test.md`**

```markdown
# Manual test checklist

Run `npm run dev` (or open the deployed site). Test on desktop Chrome, desktop Firefox and one
Android or iOS phone.

## Rendering
- [ ] Pixels are crisp (no blur) at every window size; resizing keeps them crisp.
- [ ] No seams or flicker at chunk borders while walking (use `?debug`; borders are every 32 tiles).
- [ ] Walking continuously for 60 s keeps ~60 fps in the debug overlay; no visible hitches.
- [ ] No grey "unbaked" squares appear at screen edges while walking normally.

## Input
- [ ] WASD and arrow keys move Gizmo; diagonals aren't faster.
- [ ] Hold W, alt-tab away, come back: Gizmo is not walking.
- [ ] Phone: touching the left part of the screen shows the joystick; dragging moves Gizmo; releasing stops.
- [ ] Phone: touching the right part of the screen does nothing; the page never scrolls or zooms.

## Gameplay
- [ ] Biome toast appears on entering a biome; "New biome discovered!" only the first time.
- [ ] Walking along a biome border doesn't spam toasts.
- [ ] Berry, golden fruit, zoom leaf, sour berry, magnet petal and sap behave as described in the spec.
- [ ] Magnet pulls nearby items in with a short flying animation.
- [ ] At 0 energy Gizmo looks sleepy, moves at half speed and the HUD hint shows; eating restores normal speed.
- [ ] Water, lava and Iceberg ice block movement; Gizmo slides along walls instead of sticking.

## Saves
- [ ] Reload restores position, energy, treasures, effects, discovered biomes and collected items.
- [ ] Same seed → same world after "New world".
- [ ] Export downloads a `.json` file; Import of that file restores it.
- [ ] Importing an unrelated `.json` shows an error and changes nothing.
- [ ] In a private window where storage is blocked, the game runs and shows the "saving isn't available" notice.
- [ ] Hiding the tab pauses the game and saves.
```

- [ ] **Step 3: Create `README.md`**

```markdown
# Gizmo's World

A cozy exploration game: wander an endless, procedurally generated pixel-art world with Gizmo,
discover biomes and collect treasures.

## Develop

    npm install
    npm run dev       # http://localhost:5173 (add ?debug for the debug overlay, F3 toggles it)
    npm test
    npm run lint
    npm run build     # static site in dist/

## Deploy

Pushing to `master` or `main` on GitHub runs `.github/workflows/deploy.yml`, which lints, tests,
builds and publishes to GitHub Pages. Enable Pages with "GitHub Actions" as the source in the repo
settings. For itch.io, zip the contents of `dist/` and upload it as an HTML game.

## Layout

- `src/core` — RNG, noise, LRU, game loop
- `src/data` — content tables (biomes, terrains, items, blocks, buildings)
- `src/world` — deterministic world generation and chunk cache
- `src/systems` — movement, energy, effects, pickups, discovery
- `src/render` — chunk baking and drawing
- `src/ui`, `src/input`, `src/save` — HUD/menu, controls, save files

Design docs live in `docs/superpowers/`.

## License

MIT — see [LICENSE](LICENSE).
```

- [ ] **Step 4: Create `LICENSE`**

```text
MIT License

Copyright (c) 2026 Jezek Sadrovy

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Add `"license": "MIT"` to `package.json` after `"version"`.

- [ ] **Step 5: Remove the legacy prototype and its traces**

```bash
git rm -r -q legacy
```

In `eslint.config.js` change the ignore line to:
```js
  globalIgnores(['dist', 'node_modules', 'coverage']),
```

In `.prettierignore` delete the `legacy` line.

Then confirm nothing still refers to it:

Run: `git grep -n -i "legacy" -- . ":(exclude)docs/superpowers"`
Expected: no output. (Matches inside `docs/superpowers/` are historical design notes and stay.)

Confirm the root contains only the new project:

Run: `git ls-files | grep -v "^src/\|^tests/\|^docs/\|^\.github/"`
Expected exactly: `.gitignore`, `.prettierignore`, `.prettierrc`, `LICENSE`, `README.md`, `eslint.config.js`, `index.html`, `package-lock.json`, `package.json`, `tsconfig.json`, `vite.config.ts`.

- [ ] **Step 6: Full verification**

Run: `npm run format && npm run lint && npm test && npm run build`
Expected: all pass. Then work through `docs/manual-test.md` in desktop Chrome with `npm run dev`, and note any items that couldn't be checked (e.g. no phone available).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: deploy workflow, docs and MIT license; remove legacy prototype"
```

---

### Task 15: Start a clean git history

**This rewrites history and cannot be undone inside the repo. Do not run it without the user's explicit go-ahead at this point, even if the plan was approved earlier.**

**Files:** none changed; the commit graph is replaced.

**Interfaces:** none.

- [ ] **Step 1: Confirm with the user**

Ask: "Ready to replace the whole git history with a single initial commit on `main`? A backup bundle will be written outside the repo." Wait for a yes.

- [ ] **Step 2: Verify a clean tree and write a backup bundle outside the repo**

```bash
git status --porcelain        # must print nothing
git bundle create "<scratchpad>/gizmo-history-backup.bundle" --all
git bundle verify "<scratchpad>/gizmo-history-backup.bundle"
```

(`<scratchpad>` = the session scratchpad directory. Tell the user its full path; they can delete it once they're happy.)

- [ ] **Step 3: Create the single-commit `main` and drop the old branches**

```bash
git checkout --orphan main
git add -A
git commit -m "Initial commit: Gizmo's World foundation (Vite + TypeScript)"
git branch -D master foundation
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

(End the commit message with the Co-Authored-By line from Global Constraints.)

- [ ] **Step 4: Verify**

Run: `git log --oneline --all && git branch -a && npm test`
Expected: exactly one commit, one branch (`main`), tests pass.
