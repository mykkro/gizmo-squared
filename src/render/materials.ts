import { hash2 } from '../core/rng';
import { parseHex, type RGB } from './color';
import { cellular, fbm, valueNoise } from './texnoise';

/** Building material texture size (2 x 2 tiles). Rows and tile widths divide it, so it tiles. */
export const MATERIAL_PX = 64;
const MASK = MATERIAL_PX - 1;

export const MATERIALS = [
  'clay',
  'slate',
  'thatch',
  'shingle',
  'plaster',
  'brick',
  'planks',
  'stone',
  'paving',
  'marble',
  'moss',
] as const;
export type Material = (typeof MATERIALS)[number];

const SEED = 9100;
const ROW = 8;

const shade = (c: RGB, f: number): RGB => [c[0] * f, c[1] * f, c[2] * f];
const hex = (h: string) => parseHex(h);
/** Per-pixel brightness noise. */
const grain = (m: number, x: number, y: number, amp: number) =>
  1 + (hash2(SEED + m, x, y, 1) - 0.5) * 2 * amp;
/** Random value in [0, 1) for a tile (column, row) of a material. */
const tileRand = (m: number, col: number, row: number) => hash2(SEED + m, col, row, 2);

/** Row and in-row position with every other row offset by half a tile. */
function bond(x: number, y: number, width: number) {
  const row = y >> 3;
  const ry = y & (ROW - 1);
  const shifted = (x + (row & 1) * (width >> 1)) & MASK;
  return { row, ry, col: Math.floor(shifted / width), lx: shifted % width };
}

const CLAY = hex('#b5532d');
const SLATE = hex('#5b6878');
const SHINGLE = hex('#7a5232');
const THATCH = hex('#c9a24e');
const PLASTER = hex('#e8dcc0');
const BRICK = hex('#a4442c');
const MORTAR = hex('#cfc6b8');
const PLANK = hex('#8a5a34');
const STONE = hex('#8a8680');
const STONE_MORTAR = hex('#6e6a62');
const PAVING = hex('#a8a29a');
const PAVING_GAP = hex('#5a5650');
const MARBLE = hex('#e9e4da');
const VEIN = hex('#a9a39a');
const MOSS = hex('#5f8a35');

function generate(m: Material, mi: number, x: number, y: number): RGB {
  const u = x / MATERIAL_PX;
  const v = y / MATERIAL_PX;
  switch (m) {
    case 'clay': {
      // Curved clay tiles in offset rows, each row shading the one below.
      const b = bond(x, y, 8);
      const curve = 0.8 + 0.35 * Math.sin((Math.PI * (b.lx + 0.5)) / 8);
      const row = b.ry >= 6 ? 0.62 : b.ry === 0 ? 1.1 : 1;
      const vary = 0.9 + 0.2 * tileRand(mi, b.col, b.row);
      return shade(CLAY, curve * row * vary * grain(mi, x, y, 0.05));
    }
    case 'slate': {
      const b = bond(x, y, 16);
      if (b.lx === 0) return shade(SLATE, 0.5);
      const row = b.ry >= 6 ? 0.68 : 1;
      const vary = 0.88 + 0.24 * tileRand(mi, b.col, b.row);
      return shade(
        SLATE,
        row * vary * (0.95 + 0.1 * fbm(u, v, 8, 2, SEED + 3)) * grain(mi, x, y, 0.04),
      );
    }
    case 'shingle': {
      // Wooden shingles of random widths: six hashed cuts per row (wrapping around).
      const row = y >> 3;
      const ry = y & (ROW - 1);
      const cuts = Array.from({ length: 6 }, (_, i) =>
        Math.floor(tileRand(mi, i, row) * MATERIAL_PX),
      ).sort((a, b) => a - b);
      if (cuts.includes(x)) return shade(SHINGLE, 0.45);
      const seg = cuts.filter((c) => c <= x).length % cuts.length;
      const vary = 0.85 + 0.3 * tileRand(mi, seg + 10, row);
      const woodgrain = 0.94 + 0.12 * valueNoise(u, v, 32, 8, SEED + 5);
      const shadow = ry >= 6 ? 0.65 : 1;
      return shade(SHINGLE, vary * woodgrain * shadow * grain(mi, x, y, 0.05));
    }
    case 'thatch': {
      const straw = 0.75 + 0.45 * valueNoise(u, v, 32, 4, SEED + 7);
      const band = (y & 15) >= 13 ? 0.72 : 1;
      return shade(THATCH, straw * band * grain(mi, x, y, 0.08));
    }
    case 'plaster':
      return shade(PLASTER, (0.9 + 0.2 * fbm(u, v, 8, 4, SEED + 9)) * grain(mi, x, y, 0.04));
    case 'brick': {
      const b = bond(x, y, 16);
      if (b.ry === ROW - 1 || b.lx === 0) return shade(MORTAR, grain(mi, x, y, 0.06));
      const vary = 0.85 + 0.3 * tileRand(mi, b.col, b.row);
      return shade(BRICK, vary * grain(mi, x, y, 0.07));
    }
    case 'planks': {
      const board = x >> 3;
      const lx = x & 7;
      if (lx === 0) return shade(PLANK, 0.45);
      if (lx === 4 && (y & 31) === 3) return shade(PLANK, 0.35); // nail
      const vary = 0.85 + 0.3 * tileRand(mi, board, 0);
      const woodgrain = 0.9 + 0.2 * valueNoise(u, v, 64, 4, SEED + 11 + board);
      return shade(PLANK, vary * woodgrain * grain(mi, x, y, 0.04));
    }
    case 'stone': {
      const c = cellular(u, v, 5, SEED + 13);
      if (c.f2 - c.f1 < 0.07) return shade(STONE_MORTAR, grain(mi, x, y, 0.08));
      const lit = 1 - (c.ox + c.oy) * 0.18;
      return shade(STONE, (0.8 + 0.35 * c.id) * lit * grain(mi, x, y, 0.06));
    }
    case 'marble': {
      // Pale stone with soft grey veins along ridges of warped noise.
      const ridge =
        1 - Math.abs(2 * fbm(u + 0.3 * fbm(u, v, 4, 2, SEED + 17), v, 4, 4, SEED + 19) - 1);
      const base = shade(
        MARBLE,
        (0.95 + 0.08 * fbm(u, v, 8, 3, SEED + 21)) * grain(mi, x, y, 0.025),
      );
      const t = Math.max(0, (ridge - 0.86) / 0.14);
      return [
        base[0] + (VEIN[0] - base[0]) * t,
        base[1] + (VEIN[1] - base[1]) * t,
        base[2] + (VEIN[2] - base[2]) * t,
      ];
    }
    case 'moss':
      return shade(MOSS, (0.7 + 0.5 * fbm(u, v, 16, 4, SEED + 23)) * grain(mi, x, y, 0.12));
    case 'paving': {
      const c = cellular(u, v, 4, SEED + 15);
      if (c.f2 - c.f1 < 0.06) return shade(PAVING_GAP, grain(mi, x, y, 0.08));
      return shade(PAVING, (0.85 + 0.25 * c.id) * grain(mi, x, y, 0.06));
    }
  }
}

const cache = new Map<Material, Uint8ClampedArray>();

function texture(m: Material): Uint8ClampedArray {
  let t = cache.get(m);
  if (!t) {
    t = new Uint8ClampedArray(MATERIAL_PX * MATERIAL_PX * 3);
    const mi = MATERIALS.indexOf(m);
    for (let y = 0; y < MATERIAL_PX; y++) {
      for (let x = 0; x < MATERIAL_PX; x++) {
        const c = generate(m, mi, x, y);
        const o = (y * MATERIAL_PX + x) * 3;
        t[o] = c[0];
        t[o + 1] = c[1];
        t[o + 2] = c[2];
      }
    }
    cache.set(m, t);
  }
  return t;
}

/** Material colour at (x, y); the texture repeats every MATERIAL_PX. */
export function materialTexel(m: Material, x: number, y: number): RGB {
  const t = texture(m);
  const o = ((y & MASK) * MATERIAL_PX + (x & MASK)) * 3;
  return [t[o], t[o + 1], t[o + 2]];
}
