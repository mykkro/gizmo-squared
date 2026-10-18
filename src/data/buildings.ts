import type { BiomeName } from './biomes';

export type RoofMaterial = 'clay' | 'slate' | 'thatch' | 'shingle';
export type WallMaterial = 'plaster' | 'brick' | 'planks' | 'stone';

export const BUILDING_STYLES = ['house', 'church', 'temple', 'ruins', 'shrine', 'well'] as const;
export type BuildingStyle = (typeof BUILDING_STYLES)[number];

export interface BuildingDef {
  name: string;
  /** How the building is drawn and which of its tiles are solid. */
  style: BuildingStyle;
  /** Footprint in tiles. */
  w: number;
  h: number;
  foundIn: Partial<Record<BiomeName, number>>;
  roof?: RoofMaterial;
  wall?: WallMaterial;
  /** Optional colour multiplied into the wall material (e.g. a red barn). */
  wallTint?: string;
  chimney?: boolean;
  /** Windmill sails over the roof. */
  sails?: boolean;
}

export const BUILDINGS: readonly BuildingDef[] = [
  {
    name: 'small_house',
    style: 'house',
    w: 3,
    h: 3,
    roof: 'clay',
    wall: 'plaster',
    chimney: true,
    foundIn: { Forest: 0.6, Grassland: 1, Beach: 0.4, Savanna: 0.5, Swamp: 0.1, Desert: 0.1 },
  },
  {
    name: 'tavern',
    style: 'house',
    w: 5,
    h: 4,
    roof: 'shingle',
    wall: 'planks',
    chimney: true,
    foundIn: { Forest: 0.4, Grassland: 0.6, Beach: 0.5 },
  },
  {
    name: 'watch_tower',
    style: 'house',
    w: 3,
    h: 5,
    roof: 'shingle',
    wall: 'stone',
    foundIn: { Forest: 0.5, Grassland: 0.3, Beach: 0.2, Desert: 0.8, Savanna: 0.5 },
  },
  {
    name: 'barn',
    style: 'house',
    w: 7,
    h: 5,
    roof: 'slate',
    wall: 'planks',
    wallTint: '#c0503a',
    foundIn: { Savanna: 1 },
  },
  {
    name: 'blacksmith',
    style: 'house',
    w: 4,
    h: 5,
    roof: 'slate',
    wall: 'stone',
    chimney: true,
    foundIn: { Forest: 0.1 },
  },
  {
    name: 'mill',
    style: 'house',
    w: 5,
    h: 5,
    roof: 'thatch',
    wall: 'plaster',
    sails: true,
    foundIn: { Grassland: 0.3 },
  },
  {
    name: 'church',
    style: 'church',
    w: 5,
    h: 7,
    roof: 'slate',
    wall: 'stone',
    foundIn: { Grassland: 0.4, Forest: 0.3, Savanna: 0.3, Snowfield: 0.5, Tundra: 0.3 },
  },
  {
    name: 'temple',
    style: 'temple',
    w: 7,
    h: 6,
    foundIn: { Desert: 0.5, Canyon: 0.5, Ruins: 0.6, Badlands: 0.3 },
  },
  {
    name: 'ruins',
    style: 'ruins',
    w: 7,
    h: 7,
    foundIn: { Ruins: 1, Badlands: 0.6, Jungle: 0.5, 'Volcanic Plains': 0.3, Mountains: 0.2 },
  },
  {
    name: 'shrine',
    style: 'shrine',
    w: 3,
    h: 3,
    foundIn: { Mountains: 0.7, Forest: 0.3, Grassland: 0.3, Jungle: 0.3 },
  },
  {
    name: 'well',
    style: 'well',
    w: 2,
    h: 2,
    foundIn: { Grassland: 0.5, Savanna: 0.4, Beach: 0.3, Desert: 0.3 },
  },
];

export const BUILDING_BY_NAME: Record<string, BuildingDef> = Object.fromEntries(
  BUILDINGS.map((b) => [b.name, b]),
);
