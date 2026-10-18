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
