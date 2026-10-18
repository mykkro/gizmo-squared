# Gizmo's World — Sub-project 1: Foundation

Date: 2026-10-18
Status: Draft for review

## Vision and roadmap

Gizmo's World becomes a **cozy exploration game**: wander an infinite procedurally
generated world, discover biomes, collect treasures, meet friendly gizmos, do light
quests. Little danger, no game over. It will be **published online** (GitHub Pages /
itch.io), so it must run well on phones with touch input, keep saves reliably, and use
only licence-clean assets. Art style: **crisp pixel art** (16×16 px tiles, integer zoom).
Stack: **Vite + TypeScript + Canvas 2D**.

The work is split into sub-projects, each with its own spec → plan → implementation:

1. **Foundation** (this document) — new stack, seeded seamless world, chunk renderer,
   input, ported gameplay, saves.
2. **Terrain rendering 2.0** — procedural pixel-art terrain textures, seamless terrain
   transitions, decorations (trees, rocks, flowers), Gizmo sprite art.
3. **Buildings & editor** — prefab format, editor page, generator placement, in-game
   build mode persisted via chunk diffs.
4. **Living world** — wandering NPC gizmos, villages.
5. **Quests & progression** — quest system, inventory, unlocks, biome atlas, sound.

Order: 1 → 2 → 3/4 (either order) → 5.

## Goals of this sub-project

- Replace the legacy global-script code with a modular TypeScript codebase.
- Deterministic world: the same seed always produces the same world, independent of
  chunk generation order, with no seams.
- Fix the legacy bugs: gameplay biome not matching visual biome, chunk connectivity /
  seam artefacts, inverted retry in `seedBiomes`, `Map`-as-object misuse, per-pixel DOM
  colour parsing, `sticky` never expiring, 60 fps-assumed timers.
- Playable end state roughly matching today's gameplay (walk, collect, biome banner) in
  cozy form, on desktop and mobile, with saves.

### Non-goals

Terrain textures and transitions, decoration sprites, new buildings or an editor, NPCs,
quests, sound. These belong to later sub-projects. The foundation only has to leave
clean extension points for them.

## Approach

Fresh rewrite in a new project structure, porting the content tables (biomes, terrains,
items, bricks, building blueprints) as typed data. The legacy game is moved unchanged to
`legacy/` for reference while porting, then deleted once the new game is complete, together
with everything that only existed for it (Pac-Man sounds, old tools). Afterwards the git
history is replaced by a single initial commit (with a backup bundle kept outside the repo). Incremental migration was rejected because most of the legacy
logic (flood-fill biome maps, per-chunk border stitching) is being replaced anyway.

## 1. Architecture

```
gizmo-squared/
├─ legacy/                  # current game moved here unchanged
├─ index.html
├─ vite.config.ts
├─ src/
│  ├─ main.ts               # bootstrap: load save → create Game → start loop
│  ├─ core/
│  │  ├─ rng.ts             # seeded PRNG (mulberry32) + hash(seed, x, y)
│  │  ├─ noise.ts           # 2D simplex noise, fractal octaves
│  │  └─ loop.ts            # fixed-step update (60 Hz) + variable render
│  ├─ data/                 # typed content ported from defs-*.js
│  │  ├─ biomes.ts  terrains.ts  items.ts  bricks.ts  buildings.ts
│  ├─ world/
│  │  ├─ World.ts           # chunk cache (LRU), getTile(tx, ty), seed, diffs
│  │  ├─ Chunk.ts           # per-chunk typed arrays
│  │  ├─ generator.ts       # pure: (seed, cx, cy) → ChunkData
│  │  └─ biomeField.ts      # climate fields → biome per tile
│  ├─ entities/
│  │  └─ Player.ts
│  ├─ systems/
│  │  ├─ movement.ts  pickups.ts  energy.ts  effects.ts  discovery.ts
│  ├─ render/
│  │  ├─ Renderer.ts        # camera, integer zoom, draw order
│  │  ├─ chunkBaker.ts      # chunk → OffscreenCanvas (cached)
│  │  ├─ sprites.ts         # code-defined pixel sprites (palette + matrix)
│  │  ├─ debugOverlay.ts
│  │  └─ hud.ts             # DOM overlay HUD + menu
│  ├─ input/
│  │  ├─ Input.ts  keyboard.ts  touchJoystick.ts
│  └─ save/
│     └─ storage.ts         # versioned JSON in localStorage, export/import
└─ tests/                   # Vitest
```

Rules:

- **Generation is pure.** `generator.ts` depends only on the seed and coordinates and
  never calls `Math.random`. Player-made changes are stored as a **chunk diff**
  applied on top of the generated chunk when it loads.
- **Layering.** `data/` imports nothing. `world/` and `entities/` hold state.
  `systems/` change state and never touch the canvas or DOM. `render/` reads state and
  never changes it. This keeps a future move to PixiJS confined to `render/`.
- **Fixed timestep.** Logic runs at 60 Hz with an accumulator, rendering runs every
  animation frame. All timers count simulated seconds.
- **Typed arrays.** Each chunk stores `terrain`, `biome`, `item`, `solid` as
  `Uint8Array(32 * 32)`, indexed `ly * 32 + lx`. Content is referenced by numeric IDs
  (array index into the `data/` tables).

## 2. World generation

All values are functions of `(seed, tileX, tileY)` sampled in **world coordinates**.
That makes seams impossible and generation order irrelevant.

### Climate fields

Three simplex fields, each with its own seed offset, normalised to 0..1:

| Field | Feature size (approx.) | Octaves |
|---|---|---|
| elevation | 150 tiles | 4 |
| temperature | 300 tiles | 3 |
| moisture | 200 tiles | 3 |

Coordinates are **domain-warped** before sampling (offset by a separate noise field,
amplitude ~20 tiles) so biome borders are organic. The exact constants live in one
`GEN_CONFIG` object and are tuned with the debug overlay.

### Biome selection

Temperature is split into cold / temperate / hot at 0.35 / 0.65. Moisture is split into
dry / medium / wet / very wet at 0.3 / 0.5 / 0.7.

| | dry | medium | wet | very wet |
|---|---|---|---|---|
| **cold** | Tundra | Snowfield | Frozen Lake | Frozen Lake |
| **temperate** | Grassland | Forest | Marsh | Swamp |
| **hot** | Desert | Savanna | Jungle | Swamp Forest |

Elevation overrides, applied in this order:

1. elevation < 0.2: **Iceberg** if cold, otherwise **Beach**.
2. elevation > 0.75 and not hot: **Mountains**.
3. elevation > 0.75 and hot: **Volcano** if elevation > 0.88; otherwise **Volcanic
   Plains** if within the Volcano foothill band (elevation > 0.82); otherwise **Badlands**
   if dry, otherwise **Canyon**.
4. **Ruins**: temperate tiles where a sparse "landmark" noise field exceeds 0.85.

This covers all 19 legacy biomes. The thresholds are tuning values in `GEN_CONFIG`; the
test requirement is that all 19 occur in a large sample.

### Terrain within a biome

Each biome keeps its legacy terrain weights. For each terrain type in the biome, a global
detail noise (feature size 4–12 tiles, varying per terrain) is sampled. The terrain with
the highest `noise × weight` wins, as in legacy `makeBiome`, but sampled globally so
patches flow across chunk borders.

### Contents

- **Items:** a tile gets an item when `hash(seed, tx, ty, "item") < biome.itemChance ×
  ITEM_DENSITY`. The type is chosen by a second hash using the legacy per-biome item
  weights, excluding `none`. Items are never placed on solid tiles.
- **Obstacles:** sparse natural obstacles (boulders everywhere; tree trunks in Forest,
  Jungle and Swamp Forest; cacti in Desert) chosen by hash, with a minimum spacing of 2
  tiles enforced by checking the hash of neighbouring tiles. They're drawn as coloured
  blocks until sub-project 2.
- **Impassable terrain:** `water`, `lava` and `ice` within Iceberg. They are marked
  `solid`. Later unlocks may make them passable.
- **Buildings:** legacy blueprints are placed deterministically: up to 2 attempts per
  chunk, position by hash, fully inside the chunk, rejected if they overlap impassable
  terrain. They're replaced in sub-project 3.
- **Spawn:** spiral search outward from (0, 0) for the nearest walkable tile, preferring
  Grassland or Forest within a 64-tile radius.

### Chunks

32 × 32 tiles. Target generation time is ≤ 3 ms per chunk on desktop. If profiling shows
frame stalls, generation moves to a Web Worker; the pure generator makes that a drop-in
change.

## 3. Rendering, camera, input

### Pixel-art pipeline

- One world unit = one texture pixel. A tile is 16 × 16 px.
- **Integer zoom** chosen so 14–18 tiles fit along the shorter screen side, at least 2×.
  The canvas backing store is sized by `devicePixelRatio`; `imageSmoothingEnabled =
  false`.
- The camera follows Gizmo with smoothing; the final draw offset is rounded to whole
  texture pixels.

### Chunk baking

- `chunkBaker` renders a chunk once into a 512 × 512 `OffscreenCanvas` (falling back to a
  `<canvas>` element).
- **Baked:** terrain (flat colour per terrain plus a ±4% per-tile shade from the hash)
  and obstacles / building bricks.
- **Drawn per frame:** items (pulsing), Gizmo, later NPCs, sorted by y position.
- At most **2 bakes per frame**. Chunks one ring beyond the viewport are generated and
  baked ahead of time. Picking up an item doesn't trigger a re-bake.
- Caches: baked canvases are LRU-limited to 32; chunk data is LRU-limited to 256
  (modified chunks keep their diff in the save state, so eviction is safe).

### Gizmo placeholder sprite

A 16 × 16 sprite defined in `sprites.ts` as a palette plus a pixel matrix, with a 2-frame
bob, left/right facing, and a "tired" variant. It's replaced in sub-project 2.

### HUD (DOM overlay)

- Energy bar, treasure counter, active effects with countdowns.
- Biome name toast (CSS fade) on entering a biome; "New biome discovered!" on first entry.
- Menu button: new world (seed entry, random by default), export save, import save, sound
  toggle (no-op until sounds exist).
- A layout that works at 360 px width and up; tap targets ≥ 44 px.

### Input

- `Input` exposes one normalised direction vector per tick.
- Keyboard: WASD and arrow keys.
- Touch: a floating joystick that appears where the thumb touches down in the left 60% of
  the screen, with a dead zone of 10% of its radius.
- Auto-pause and save on `visibilitychange` to hidden.

### Debug overlay

Toggled with F3 or the `?debug` URL parameter. Shows FPS, loaded and baked chunk counts,
bakes per frame, tile coordinates, biome, climate values, and a toggle that tints the
world by biome.

## 4. Gameplay and saving

### Movement

- Hitbox 10 × 8 px at Gizmo's feet. Collision is resolved one axis at a time against
  `solid` tiles, giving wall sliding.
- Base speed 4.5 tiles/s. Terrain multipliers: mud, bog, swamp ×0.7; sand, snow ×0.85;
  ice ×1.1 with momentum (velocity lerps towards the target at a lower rate); others ×1.

### Energy

- Range 0–100, start 100. Drains 1 point per 6 s while moving, nothing while still.
- "heal" biomes regenerate 1 point per 3 s; "decay" biomes double the drain.
- At 0, Gizmo is **tired**: ×0.5 speed, tired sprite, a gentle hint in the HUD. There is
  no death or game over.

### Items

| Legacy | New name | Effect | Treasure |
|---|---|---|---|
| red | Berry | +15 energy | 1 |
| orange | Golden fruit | energy to 100 | 5 |
| cyan | Zoom leaf | speed ×1.8 for 10 s | 2 |
| poison | Sour berry | −10 energy, 1.5 s wobble | 0 |
| ultra | Magnet petal | items within 4 tiles drift to Gizmo, 15 s | 3 |
| sticky | Sap | speed ×0.6 for 6 s | 0 |

Timed effects live in a list of `{ kind, expiresAt }`. Speed is recalculated each tick as
the product of the base speed, terrain, tired state and active effect multipliers.
Picking up an effect that is already active refreshes its timer and doesn't stack it.

### Discovery

`discoveredBiomes` records each biome on first entry and triggers the discovery toast.

### Save format

```json
{
  "version": 1,
  "seed": "maple-17",
  "player": { "x": 0, "y": 0, "energy": 80, "treasures": 42, "effects": [] },
  "discoveredBiomes": ["Grassland"],
  "chunkDiffs": { "3,-2": { "picked": [17, 540] } }
}
```

- `picked` holds local tile indices (`ly * 32 + lx`) of collected items.
- Stored under the localStorage key `gizmo.save`. Auto-saved every 10 s, on tab hide and
  from the menu.
- Loading runs `migrate(data)` keyed on `version`.
- If parsing or validation fails, the raw string is copied to `gizmo.save.corrupt-<timestamp>`,
  a new world starts and a notice is shown.
- Export downloads `gizmo-save-<seed>.json`; import validates the file before replacing
  the current save.
- If localStorage is unavailable (private mode), the game runs and the menu warns that
  progress won't persist.

## 5. Testing, tooling, deployment

### Unit tests (Vitest)

- `rng`, `noise`: deterministic for a given seed, output within range.
- `generator`: identical output for the same `(seed, cx, cy)` regardless of generation
  order. **Seam test:** tiles of four neighbouring chunks equal a direct per-tile sample
  of the same region.
- `biomeField`: a table of climate inputs maps to the expected biomes; all 19 biomes occur
  within a 2048 × 2048-tile sample for a fixed seed.
- Generator invariants: no item on a solid tile; the spawn tile is walkable.
- `movement`: sliding along walls; never ending up inside a solid tile under random input.
- `effects`: refresh, expiry and speed recalculation.
- `storage`: round trip, migration, corrupt-save backup, import validation.

Rendering and input are checked manually against a checklist in `docs/manual-test.md`:
desktop Chrome and Firefox, plus one Android or iOS phone.

### Tooling

- TypeScript `strict`, ESLint, Prettier.
- npm scripts: `dev`, `build`, `test`, `lint`, `preview`.
- A GitHub Actions workflow on push to the default branch runs lint, test and build, then
  deploys `dist/` to GitHub Pages (Vite `base` set for the repo path). This needs a GitHub
  remote, which the repo doesn't have yet.
- The Pac-Man sounds are removed.
- The repo ships `.gitignore`, `README.md` and an MIT `LICENSE` (© 2026 Jezek Sadrovy).

## Done criteria

1. `npm run dev` runs the game, `npm test` passes, `npm run build` produces a deployable
   `dist/`.
2. Same seed means the same world, also after a reload; no visible chunk seams or biome
   discontinuities.
3. All 19 biomes appear, laid out by climate; the biome toast matches the biome under
   Gizmo.
4. 60 fps while walking continuously on a desktop and a mid-range phone, with no visible
   stalls when chunks bake.
5. Keyboard and touch both work; saving, loading, exporting and importing work.
6. The legacy prototype and its assets are gone; the repo contains only the new project plus
   `.gitignore`, `README.md` and `LICENSE` (MIT).
7. Git history is a single initial commit on `main` (after explicit confirmation, with a
   backup bundle written outside the repo).
