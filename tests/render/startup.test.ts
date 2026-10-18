import { describe, expect, it } from 'vitest';
import '../../src/render/minimap';
import '../../src/render/Renderer';
import { texturesGenerated } from '../../src/render/textures';

describe('startup', () => {
  it('importing the renderer and minimap generates no textures (they are lazy)', () => {
    expect(texturesGenerated()).toBe(0);
  });
});
