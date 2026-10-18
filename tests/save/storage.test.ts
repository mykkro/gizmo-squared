import { describe, expect, it } from 'vitest';
import { SAVE_KEY } from '../../src/config';
import {
  SaveError,
  loadSave,
  parseSave,
  writeSave,
  type KeyValueStore,
  type SaveData,
} from '../../src/save/storage';

const valid: SaveData = {
  version: 1,
  seed: 'maple-17',
  player: { x: 10, y: 20, energy: 80, treasures: 3, effects: [{ kind: 'zoom', remaining: 4 }] },
  discoveredBiomes: ['Forest'],
  chunkDiffs: { '0,0': { picked: [1, 2] }, '-1,3': { picked: [] } },
};

class MemoryStore implements KeyValueStore {
  data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

class FullStore extends MemoryStore {
  setItem(): void {
    throw new Error('QuotaExceededError');
  }
}

const mutate = (fn: (o: Record<string, unknown>) => void): string => {
  const o = structuredClone(valid) as unknown as Record<string, unknown>;
  fn(o);
  return JSON.stringify(o);
};

describe('save storage', () => {
  it('round-trips through the store', () => {
    const store = new MemoryStore();
    expect(writeSave(store, valid)).toBe(true);
    expect(loadSave(store)).toEqual({ status: 'ok', data: valid });
  });

  it('reports an empty store', () => {
    expect(loadSave(new MemoryStore())).toEqual({ status: 'empty' });
  });

  it('backs up a corrupt save instead of losing it', () => {
    const store = new MemoryStore();
    store.setItem(SAVE_KEY, '{not json');
    const r = loadSave(store, 1000);
    expect(r).toEqual({ status: 'corrupt', backupKey: `${SAVE_KEY}.corrupt-1000` });
    expect(store.getItem(`${SAVE_KEY}.corrupt-1000`)).toBe('{not json');
  });

  it('still reports corrupt when the backup cannot be written', () => {
    const store = new FullStore();
    store.data.set(SAVE_KEY, 'garbage');
    expect(loadSave(store, 5).status).toBe('corrupt');
  });

  it('writeSave returns false when storage is full', () => {
    expect(writeSave(new FullStore(), valid)).toBe(false);
  });

  it.each([
    ['newer version', mutate((o) => (o.version = 2))],
    ['missing seed', mutate((o) => delete o.seed)],
    ['empty seed', mutate((o) => (o.seed = ''))],
    ['bad energy', mutate((o) => ((o.player as Record<string, unknown>).energy = 'full'))],
    [
      'unknown effect',
      mutate(
        (o) => ((o.player as Record<string, unknown>).effects = [{ kind: 'fly', remaining: 1 }]),
      ),
    ],
    ['picked out of range', mutate((o) => (o.chunkDiffs = { '0,0': { picked: [1024] } }))],
    ['negative picked', mutate((o) => (o.chunkDiffs = { '0,0': { picked: [-1] } }))],
    ['biomes not strings', mutate((o) => (o.discoveredBiomes = [1]))],
    ['array instead of object', '[]'],
    ['not json', 'hello'],
  ])('rejects %s', (_label, raw) => {
    expect(() => parseSave(raw)).toThrow(SaveError);
  });
});
