import { describe, expect, it } from 'vitest';
import { fogMask } from '../../src/render/fog';
import { ExploredMap } from '../../src/world/explored';

describe('fogMask', () => {
  it('is transparent over explored cells and opaque elsewhere', () => {
    const m = new ExploredMap();
    m.reveal(0, 0);
    const mask = fogMask(m, -2, -2, 4, 4);
    expect(mask).toHaveLength(16);
    expect(mask[2 * 4 + 2]).toBe(0); // cell (0, 0)
    expect(fogMask(m, 50, 50, 1, 1)[0]).toBe(255);
  });
});
