import { describe, expect, it } from 'vitest';
import { TERRAINS } from '../../src/data/terrains';
import { TEX_PX, averageRGB, getTexture, texel } from '../../src/render/textures';

describe('terrain textures', () => {
  it('exist for every terrain with the right size and are cached', () => {
    TERRAINS.forEach((_, i) => {
      const t = getTexture(i);
      expect(t.length).toBe(TEX_PX * TEX_PX * 3);
      expect(getTexture(i)).toBe(t);
    });
  });

  it('wrap in world space (texel repeats every TEX_PX)', () => {
    expect(texel(0, 5, 7)).toEqual(texel(0, 5 + TEX_PX, 7 - 3 * TEX_PX));
  });

  it('are textured (not flat) and seamless across the wrap', () => {
    TERRAINS.forEach((t, i) => {
      const tex = getTexture(i);
      const lum = (x: number, y: number) => {
        const o = (y * TEX_PX + x) * 3;
        return tex[o] * 0.3 + tex[o + 1] * 0.59 + tex[o + 2] * 0.11;
      };
      let min = 255;
      let max = 0;
      let inner = 0;
      let wrap = 0;
      for (let y = 0; y < TEX_PX; y++) {
        for (let x = 0; x < TEX_PX; x++) {
          min = Math.min(min, lum(x, y));
          max = Math.max(max, lum(x, y));
        }
        inner += Math.abs(lum(64, y) - lum(63, y));
        wrap += Math.abs(lum(0, y) - lum(TEX_PX - 1, y));
      }
      expect(max - min, t.key).toBeGreaterThan(12);
      expect(wrap, t.key).toBeLessThan(inner * 2.5 + TEX_PX * 4);
    });
  });

  it('average colour is a valid RGB triple', () => {
    TERRAINS.forEach((_, i) => {
      const a = averageRGB(i);
      expect(a).toHaveLength(3);
      a.forEach((c) => {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(255);
      });
    });
  });
});
