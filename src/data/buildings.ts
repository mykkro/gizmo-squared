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

export type RoofMaterial = 'clay' | 'slate' | 'thatch' | 'shingle';
export type WallMaterial = 'plaster' | 'brick' | 'planks' | 'stone';

export interface BuildingDef {
  name: string;
  /** Houses are solid with a roof; open structures keep walkable blueprint floors. */
  kind: 'house' | 'open';
  blueprint: readonly string[];
  foundIn: Partial<Record<BiomeName, number>>;
  roof?: RoofMaterial;
  wall?: WallMaterial;
  /** Optional colour multiplied into the wall material (e.g. a red barn). */
  wallTint?: string;
  chimney?: boolean;
}

export const BUILDINGS: readonly BuildingDef[] = [
  {
    name: 'small_house',
    kind: 'house',
    roof: 'clay',
    wall: 'plaster',
    chimney: true,
    blueprint: ['###', '#.#', '###'],
    foundIn: { Forest: 0.6, Grassland: 1, Beach: 0.4, Savanna: 0.5, Swamp: 0.1, Desert: 0.1 },
  },
  {
    name: 'tavern',
    kind: 'house',
    roof: 'shingle',
    wall: 'planks',
    chimney: true,
    blueprint: ['$$$$$', '$...$', '$...$', '$$$$$'],
    foundIn: { Forest: 0.4, Grassland: 0.6, Beach: 0.5 },
  },
  {
    name: 'shrine',
    kind: 'open',
    blueprint: ['..@..', '.@@@.', '@@@@@', '@+ +@', '@@@@@', '.@@@.', '..@..'],
    foundIn: { Forest: 0.3, Grassland: 0.5, Beach: 0.4, Mountains: 0.7, Ruins: 0.9 },
  },
  {
    name: 'watch_tower',
    kind: 'house',
    roof: 'shingle',
    wall: 'stone',
    blueprint: ['&&&', '&.&', '&&&', '.&.', '.&.'],
    foundIn: { Forest: 0.5, Grassland: 0.3, Beach: 0.2, Desert: 0.8, Savanna: 0.5 },
  },
  {
    name: 'barn',
    kind: 'house',
    roof: 'slate',
    wall: 'planks',
    wallTint: '#c0503a',
    blueprint: ['*******', '*.....*', '*.....*', '*.....*', '*******'],
    foundIn: { Savanna: 1 },
  },
  {
    name: 'blacksmith',
    kind: 'house',
    roof: 'slate',
    wall: 'stone',
    chimney: true,
    blueprint: ['%%%%', '%..%', '%..%', '%..%', '%%%%'],
    foundIn: { Forest: 0.1 },
  },
  {
    name: 'mill',
    kind: 'house',
    roof: 'thatch',
    wall: 'plaster',
    blueprint: ['OOOOO', 'O...O', 'O*.*O', 'O...O', 'OOOOO'],
    foundIn: { Grassland: 0.1 },
  },
  {
    name: 'temple',
    kind: 'open',
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
