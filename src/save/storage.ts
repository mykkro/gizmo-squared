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
  { status: 'empty' } | { status: 'ok'; data: SaveData } | { status: 'corrupt'; backupKey: string };

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
  if (
    !Array.isArray(o.discoveredBiomes) ||
    !o.discoveredBiomes.every((b) => typeof b === 'string')
  ) {
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
