import { describe, expect, it } from 'vitest';
import { ExploredMap, isValidExploredData } from '../../src/world/explored';

describe('ExploredMap', () => {
  it('reveals a radius around a tile, including negative coordinates', () => {
    const m = new ExploredMap();
    m.reveal(0, 0);
    expect(m.isTileRevealed(0, 0)).toBe(true);
    expect(m.isTileRevealed(6, 0)).toBe(true);
    expect(m.isTileRevealed(-5, 0)).toBe(true);
    expect(m.isTileRevealed(24, 0)).toBe(false);
    m.reveal(-300, -300);
    expect(m.isTileRevealed(-300, -300)).toBe(true);
    expect(m.isTileRevealed(-270, -300)).toBe(false);
  });

  it('reports and counts only new reveals', () => {
    const m = new ExploredMap();
    expect(m.reveal(10, 10)).toBe(true);
    const rev = m.revision;
    expect(m.reveal(10, 10)).toBe(false);
    expect(m.revision).toBe(rev);
    expect(m.reveal(40, 10)).toBe(true);
    expect(m.revision).toBeGreaterThan(rev);
  });

  it('round-trips through serialisation', () => {
    const m = new ExploredMap();
    m.reveal(0, 0);
    m.reveal(-1000, 700);
    const data = m.serialize();
    expect(isValidExploredData(data)).toBe(true);
    const back = ExploredMap.deserialize(data);
    for (const [x, y] of [
      [0, 0],
      [-1000, 700],
      [5, 5],
      [500, 500],
    ]) {
      expect(back.isTileRevealed(x, y)).toBe(m.isTileRevealed(x, y));
    }
  });

  it('rejects malformed data', () => {
    expect(isValidExploredData({ '0,0': 'abc' })).toBe(false);
    expect(isValidExploredData({ 'x,y': new ExploredMap().serialize()['0,0'] ?? '' })).toBe(false);
    expect(isValidExploredData([])).toBe(false);
    expect(isValidExploredData({})).toBe(true);
  });
});
