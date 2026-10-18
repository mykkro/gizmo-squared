import { CHUNK_SIZE, SAVE_KEY, TILE_PX } from '../config';
import { EFFECT_KINDS } from '../data/items';
import type { ActiveEffect } from '../entities/Player';
import { chunkKey, localIndex, tileToChunk, tileToLocal } from '../world/chunk';
import type { ChunkDiff } from '../world/World';

export const SAVE_VERSION = 2;

export interface SaveData {
  version: 2;
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

const V1_TILE_PX = 16;
const V1_CHUNK_SIZE = 32;

/**
 * v1 used 16 px tiles and 32-tile chunks. Scales the player position and re-keys collected
 * items to the current chunk layout. Anything malformed is returned unconverted so that
 * validation rejects it.
 */
function migrateV1(o: Record<string, unknown>): unknown {
  const p = o.player;
  if (!isObj(p) || !isNum(p.x) || !isNum(p.y) || !isObj(o.chunkDiffs)) return o;
  const scale = TILE_PX / V1_TILE_PX;
  const chunkDiffs: Record<string, ChunkDiff> = {};
  for (const [key, d] of Object.entries(o.chunkDiffs)) {
    const m = /^(-?\d+),(-?\d+)$/.exec(key);
    if (!m || !isObj(d) || !Array.isArray(d.picked)) return o;
    for (const i of d.picked) {
      if (!Number.isInteger(i) || i < 0 || i >= V1_CHUNK_SIZE * V1_CHUNK_SIZE) return o;
      const tx = Number(m[1]) * V1_CHUNK_SIZE + (i % V1_CHUNK_SIZE);
      const ty = Number(m[2]) * V1_CHUNK_SIZE + Math.floor(i / V1_CHUNK_SIZE);
      const k = chunkKey(tileToChunk(tx), tileToChunk(ty));
      (chunkDiffs[k] ??= { picked: [] }).picked.push(localIndex(tileToLocal(tx), tileToLocal(ty)));
    }
  }
  return { ...o, version: 2, player: { ...p, x: p.x * scale, y: p.y * scale }, chunkDiffs };
}

/** Upgrades older save shapes to the current version, one step at a time. */
export function migrate(o: unknown): unknown {
  if (isObj(o) && o.version === 1) return migrateV1(o);
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
