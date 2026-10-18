import { describe, expect, it } from 'vitest';
import '../../src/render/minimap';
import '../../src/render/Renderer';
import { texturesGenerated } from '../../src/render/textures';

describe('startup', () => {
  it('importing the renderer and minimap generates no textures (they are lazy)', () => {
    expect(texturesGenerated()).toBe(0);
  });
});

describe('minimap before textures are warm', () => {
  it('composes without generating any terrain textures', async () => {
    const { MinimapModel } = await import('../../src/render/minimap');
    const { ExploredMap } = await import('../../src/world/explored');
    const explored = new ExploredMap();
    explored.reveal(0, 0);
    const m = new MinimapModel((tx) => (tx < 0 ? 3 : 5), explored);
    const out = new Uint8ClampedArray(160 * 160 * 4);
    while (!m.compose(0, 0, out));
    expect(texturesGenerated()).toBe(0);
  });
});
