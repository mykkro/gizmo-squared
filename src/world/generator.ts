import { CHUNK_SIZE } from '../config';
import { makeFractalNoise, type Noise2D } from '../core/noise';
import { hash2, pickWeighted } from '../core/rng';
import { BIOMES } from '../data/biomes';
import { BLOCK_ID, NO_BLOCK } from '../data/blocks';
import { BUILDINGS, BUILDING_BY_NAME, type BuildingDef } from '../data/buildings';
import { ITEM_ID, NO_ITEM } from '../data/items';
import { TERRAINS, TERRAIN_INDEX, type TerrainKey } from '../data/terrains';
import { BiomeField } from './biomeField';
import { createChunkData, localIndex, type ChunkData } from './chunk';
import { GEN_CONFIG } from './genConfig';
import { ruinsWallMask } from './structures';

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

  isTerrainSolid(terrain: number): boolean {
    return TERRAINS[terrain].solid;
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
        if (this.isTerrainSolid(terrain)) {
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
      // Keep a one-tile margin so roof overhang and drop shadow stay inside this chunk.
      const ox =
        1 + Math.floor(hash2(this.seed, chunk.cx, chunk.cy, salt + 2) * (CHUNK_SIZE - b.w - 1));
      const oy =
        1 + Math.floor(hash2(this.seed, chunk.cx, chunk.cy, salt + 3) * (CHUNK_SIZE - b.h - 1));
      if (this.canPlace(chunk, b, ox, oy, stamped)) {
        const seed = Math.floor(hash2(this.seed, chunk.cx, chunk.cy, salt + 4) * 0x7fffffff);
        this.stamp(chunk, b, ox, oy, seed, stamped);
      }
    }
  }

  private canPlace(
    chunk: ChunkData,
    b: BuildingDef,
    ox: number,
    oy: number,
    stamped: Uint8Array,
  ): boolean {
    for (let y = 0; y < b.h; y++) {
      for (let x = 0; x < b.w; x++) {
        const i = localIndex(ox + x, oy + y);
        if (stamped[i] || this.isTerrainSolid(chunk.terrain[i])) return false;
      }
    }
    return true;
  }

  private stamp(
    chunk: ChunkData,
    b: BuildingDef,
    ox: number,
    oy: number,
    seed: number,
    stamped: Uint8Array,
  ) {
    chunk.buildings.push({ index: BUILDINGS.indexOf(b), ox, oy, seed });
    const walls = b.style === 'ruins' ? ruinsWallMask(seed, b.w, b.h) : null;
    for (let y = 0; y < b.h; y++) {
      for (let x = 0; x < b.w; x++) {
        const i = localIndex(ox + x, oy + y);
        stamped[i] = 1;
        chunk.block[i] = NO_BLOCK;
        // Ruins: only walls are solid (items may lie inside). Temple: the front step is walkable.
        const solid = walls ? walls[y * b.w + x] : b.style === 'temple' && y === b.h - 1 ? 0 : 1;
        chunk.solid[i] = solid;
        if (solid) chunk.item[i] = NO_ITEM;
      }
    }
    if (walls) this.placeChests(chunk, b, ox, oy, seed, walls);
  }

  /** One or two (not yet openable) chests on a ruin's floor, never just inside the entrance. */
  private placeChests(
    chunk: ChunkData,
    b: BuildingDef,
    ox: number,
    oy: number,
    seed: number,
    walls: Uint8Array,
  ) {
    const count = hash2(seed, 0, 0, 20) < 0.5 ? 1 : 2;
    for (let n = 0; n < count; n++) {
      for (let attempt = 0; attempt < 8; attempt++) {
        const x = 1 + ((hash2(seed, n, attempt, 21) * (b.w - 2)) | 0);
        const y = 1 + ((hash2(seed, n, attempt, 22) * (b.h - 3)) | 0); // keep the row inside the door free
        const i = localIndex(ox + x, oy + y);
        if (walls[y * b.w + x] || chunk.block[i] !== NO_BLOCK) continue;
        chunk.block[i] = BLOCK_ID.chest;
        chunk.solid[i] = 1;
        chunk.item[i] = NO_ITEM;
        break;
      }
    }
  }
}
