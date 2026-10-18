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
    terrains: { ice: 0.6, water: 0.3, snow: 0.1 },
    itemChance: 0.2,
    items: { berry: 1, zoom: 1, golden: 0.2, sour: 0.5 },
    obstacles: {},
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
