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
