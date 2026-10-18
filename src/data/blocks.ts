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
