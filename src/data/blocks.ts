export const BLOCK_KEYS = ['boulder', 'tree', 'cactus', 'chest'] as const;

export type BlockKey = (typeof BLOCK_KEYS)[number];

export interface BlockDef {
  id: number;
  key: BlockKey;
  color: string;
  /** Solid single-tile props: scattered obstacles, or chests placed in ruins. */
  kind: 'obstacle';
}

export const NO_BLOCK = 0;

const DEFS: Record<BlockKey, Pick<BlockDef, 'color' | 'kind'>> = {
  boulder: { color: '#8a8580', kind: 'obstacle' },
  tree: { color: '#2d6a2f', kind: 'obstacle' },
  cactus: { color: '#4f9a3c', kind: 'obstacle' },
  chest: { color: '#8a5a2c', kind: 'obstacle' },
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
