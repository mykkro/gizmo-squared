import { hash2 } from '../core/rng';
import { TERRAINS, type TerrainKey } from '../data/terrains';
import { parseHex, type RGB } from './color';
import { cellular, fbm, valueNoise } from './texnoise';

/** Generated texture size in pixels (8 x 8 tiles). Power of two so world coords wrap with &. */
export const TEX_PX = 256;
const MASK = TEX_PX - 1;

type Kind = 'fbm' | 'ridged' | 'streaks' | 'ripples' | 'waves' | 'cells' | 'speckle';
type Detail =
  | 'tufts'
  | 'pebbles'
  | 'stones'
  | 'shells'
  | 'cracks'
  | 'drifts'
  | 'icecracks'
  | 'twigs'
  | 'litter'
  | 'crust'
  | 'sparkle'
  | 'algae'
  | 'glow';

interface Recipe {
  /** Dark to light. */
  palette: string[];
  kind: Kind;
  /** Feature frequency (integer, cells per texture). */
  scale: number;
  details?: Detail[];
  /** Per-pixel brightness noise amplitude (default 0.06). */
  grain?: number;
}

const RECIPES: Record<TerrainKey, Recipe> = {
  grass: {
    palette: ['#2b6420', '#3d7e25', '#4fa836', '#6fc845'],
    kind: 'streaks',
    scale: 8,
    details: ['tufts'],
  },
  grassland: {
    palette: ['#5a9632', '#73b843', '#8fd65a', '#b2ea7e'],
    kind: 'streaks',
    scale: 6,
    details: ['tufts'],
  },
  forest_floor: {
    palette: ['#2a3519', '#3b4a24', '#4a5a2c', '#5f6f3a'],
    kind: 'speckle',
    scale: 12,
    details: ['litter', 'twigs'],
  },
  dirt: {
    palette: ['#56371a', '#73492a', '#8b5a2b', '#a2703e'],
    kind: 'ridged',
    scale: 10,
    details: ['pebbles', 'stones'],
  },
  sand: {
    palette: ['#d2b46c', '#e3c886', '#f0d898', '#fbecbf'],
    kind: 'ripples',
    scale: 14,
    details: ['stones', 'shells'],
  },
  snow: {
    palette: ['#c9d8de', '#dfe9ed', '#eff5f6', '#ffffff'],
    kind: 'fbm',
    scale: 6,
    details: ['drifts', 'sparkle'],
  },
  water: {
    palette: ['#1b58ad', '#2f7fe0', '#4f98ec', '#8cc2f7'],
    kind: 'waves',
    scale: 10,
    grain: 0.03,
  },
  lava: {
    palette: ['#260e05', '#4a1a0c', '#6a2610'],
    kind: 'cells',
    scale: 10,
    details: ['glow', 'crust'],
  },
  stone: {
    palette: ['#525252', '#6a6a6a', '#7d7d7d', '#999999'],
    kind: 'cells',
    scale: 8,
    details: ['cracks'],
  },
  mud: {
    palette: ['#3a2612', '#5a3d1f', '#6b4a26', '#7d5a32'],
    kind: 'ridged',
    scale: 8,
    details: ['pebbles'],
  },
  ice: {
    palette: ['#8cc2e0', '#b5dcf2', '#cbe8f8', '#eaf7ff'],
    kind: 'streaks',
    scale: 4,
    details: ['icecracks', 'sparkle'],
  },
  swamp: {
    palette: ['#1c4a23', '#2a6131', '#2f7a3a', '#3f8a45'],
    kind: 'ridged',
    scale: 10,
    details: ['algae'],
  },
  rock: {
    palette: ['#2e2e2e', '#454545', '#5c5c5c', '#757575'],
    kind: 'cells',
    scale: 6,
    details: ['cracks'],
  },
  snowy_dirt: {
    palette: ['#6a5b4d', '#a39a90', '#d9d4ce', '#f4f2ee'],
    kind: 'fbm',
    scale: 10,
    details: ['drifts', 'pebbles'],
  },
  volcanic_rock: {
    palette: ['#1f1810', '#3a2e22', '#4a3a2a', '#5e4a36'],
    kind: 'cells',
    scale: 8,
    details: ['cracks'],
  },
  bog: {
    palette: ['#2c250e', '#4a3e22', '#5a4a2c', '#6a5a36'],
    kind: 'speckle',
    scale: 10,
    details: ['pebbles'],
  },
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const contrast = (v: number) => clamp01((v - 0.5) * 2 + 0.5);
const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const scale = (c: RGB, f: number): RGB => [c[0] * f, c[1] * f, c[2] * f];

function paletteAt(stops: RGB[], v: number): RGB {
  const pos = clamp01(v) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(pos));
  return mix(stops[i], stops[i + 1], pos - i);
}

const PEBBLE: RGB = [138, 125, 107];
const STONE: RGB = [154, 148, 138];
const SHELL: RGB = [255, 246, 232];
const TWIG: RGB = [58, 42, 24];
const LITTER: RGB = [107, 74, 38];
const ALGAE: RGB = [127, 191, 58];
const GLOW: RGB = [255, 170, 50];
const WHITE: RGB = [255, 255, 255];
const FOAM: RGB = [230, 245, 255];

/** A shaded round stone around the nearest cellular point: lit top-left, outlined. */
function roundStone(c: RGB, f1: number, ox: number, oy: number, radius: number, base: RGB): RGB {
  if (f1 >= radius) return c;
  const lit = -(ox + oy) / (radius * Math.SQRT2);
  const body = scale(base, 0.85 + 0.35 * lit);
  return f1 > radius * 0.8 ? scale(body, 0.7) : body;
}

/** Colour of one texture pixel. */
function sample(r: Recipe, stops: RGB[], seed: number, px: number, py: number): RGB {
  const x = px / TEX_PX;
  const y = py / TEX_PX;
  const s = r.scale;
  const has = (d: Detail) => r.details?.includes(d) ?? false;
  let v: number;
  let glow = 0;
  let foam = 0;

  switch (r.kind) {
    case 'fbm':
      v = contrast(fbm(x, y, s, 5, seed));
      break;
    case 'ridged':
      v = contrast(
        0.6 * (1 - Math.abs(2 * fbm(x, y, s, 5, seed) - 1)) + 0.4 * fbm(x, y, s * 2, 3, seed + 9),
      );
      break;
    case 'streaks':
      // Fast variation across x, slow along y: blades / streaks.
      v = contrast(0.65 * fbm(x, y, s, 4, seed) + 0.35 * valueNoise(x, y, s * 16, s * 5, seed + 7));
      break;
    case 'ripples': {
      const warp = 0.35 * fbm(x, y, 4, 3, seed + 3);
      const band = Math.sin(2 * Math.PI * (y * s + warp));
      v = clamp01(0.55 + 0.25 * band + 0.35 * (valueNoise(x, y, 64, 64, seed + 5) - 0.5));
      break;
    }
    case 'waves': {
      const warp = 0.6 * fbm(x, y, 4, 3, seed + 3);
      const band = Math.sin(2 * Math.PI * (x * 2 + y * s + warp));
      v = clamp01(0.45 + 0.2 * band + 0.3 * (fbm(x, y, 8, 3, seed) - 0.5));
      if (band > 0.93) foam = 0.35;
      break;
    }
    case 'cells': {
      const cell = cellular(x, y, s, seed);
      v = clamp01(
        0.45 * contrast(fbm(x, y, 16, 3, seed + 1)) +
          0.4 * (1 - Math.min(1, cell.f1)) +
          0.25 * (cell.id - 0.5),
      );
      const edge = cell.f2 - cell.f1;
      if (edge < 0.08) {
        if (has('glow')) glow = 1 - edge / 0.08;
        else v *= 0.55 + (edge / 0.08) * 0.4;
      }
      break;
    }
    case 'speckle': {
      v = contrast(fbm(x, y, s, 5, seed));
      if (cellular(x, y, s * 3, seed + 2).f1 < 0.16) v = clamp01(v + 0.25);
      break;
    }
  }
  let c = paletteAt(stops, v);

  for (const d of r.details ?? []) {
    switch (d) {
      case 'tufts': {
        if (cellular(x, y, 24, seed + 21).f1 < 0.33) c = scale(c, 0.78);
        if (valueNoise(x, y, 160, 24, seed + 22) > 0.8) c = scale(c, 1.22);
        break;
      }
      case 'pebbles': {
        const p = cellular(x, y, 28, seed + 31);
        if (p.id < 0.7) c = roundStone(c, p.f1, p.ox, p.oy, 0.2 + 0.1 * p.id, PEBBLE);
        break;
      }
      case 'stones': {
        const p = cellular(x, y, 10, seed + 33);
        if (p.id < 0.35) c = roundStone(c, p.f1, p.ox, p.oy, 0.22, STONE);
        break;
      }
      case 'shells':
        if (hash2(seed, px, py, 34) < 0.004) c = mix(c, SHELL, 0.85);
        break;
      case 'cracks': {
        const k = cellular(x, y, s * 2, seed + 41);
        const e = k.f2 - k.f1;
        if (k.id < 0.5) {
          if (e < 0.03) c = scale(c, 0.5);
          else if (e < 0.055 && k.ox > 0) c = scale(c, 1.12);
        }
        break;
      }
      case 'drifts':
        c = scale(c, 0.92 + 0.16 * valueNoise(x, y, 4, 48, seed + 51));
        break;
      case 'icecracks': {
        const k = cellular(x, y, 6, seed + 61);
        const e = k.f2 - k.f1;
        if (e < 0.025) c = mix(c, WHITE, 0.6);
        else if (e < 0.045) c = scale(c, 0.88);
        break;
      }
      case 'twigs':
        // Short diagonal twigs: noise on rotated axes (u + v, u - v still wrap every 1).
        if (valueNoise((((x + y) % 1) + 1) % 1, (((x - y) % 1) + 1) % 1, 16, 96, seed + 71) > 0.86)
          c = mix(c, TWIG, 0.75);
        break;
      case 'litter':
        if (cellular(x, y, s * 4, seed + 6).f1 < 0.12) c = mix(c, LITTER, 0.6);
        break;
      case 'crust':
        c = scale(c, 0.8 + 0.4 * (1 - Math.abs(2 * fbm(x, y, 32, 3, seed + 81) - 1)));
        break;
      case 'algae':
        if (cellular(x, y, s * 2, seed + 4).f1 < 0.2) c = mix(c, ALGAE, 0.55);
        break;
      case 'sparkle':
        if (hash2(seed, px, py, 9) < 0.006) c = mix(c, WHITE, 0.85);
        break;
      case 'glow':
        break; // handled with the cell edges above
    }
  }
  if (glow > 0) c = mix(c, GLOW, glow);
  if (foam > 0) c = mix(c, FOAM, foam);

  const grain = r.grain ?? 0.06;
  return scale(c, 1 + (hash2(seed, px, py, 11) - 0.5) * 2 * grain);
}

/** Fills rows [rowStart, rowEnd) of a terrain texture. */
function generateRows(index: number, out: Uint8ClampedArray, rowStart: number, rowEnd: number) {
  const r = RECIPES[TERRAINS[index].key];
  const stops = r.palette.map(parseHex);
  const seed = 1000 + index * 17;
  for (let py = rowStart; py < rowEnd; py++) {
    for (let px = 0; px < TEX_PX; px++) {
      const c = sample(r, stops, seed, px, py);
      const o = (py * TEX_PX + px) * 3;
      out[o] = c[0];
      out[o + 1] = c[1];
      out[o + 2] = c[2];
    }
  }
}

/** Generates a whole terrain texture (pure; not cached). */
export function generateTexture(index: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(TEX_PX * TEX_PX * 3);
  generateRows(index, out, 0, TEX_PX);
  return out;
}

const cache: Uint8ClampedArray[] = [];
const averages: RGB[] = [];
/** Texture being generated in the background by warmTextures. */
let partial: { index: number; data: Uint8ClampedArray; row: number } | null = null;

/** RGB texture (TEX_PX² x 3) of a terrain, generated on first use. */
export function getTexture(index: number): Uint8ClampedArray {
  if (!cache[index]) {
    if (partial?.index === index) {
      generateRows(index, partial.data, partial.row, TEX_PX);
      cache[index] = partial.data;
      partial = null;
    } else {
      cache[index] = generateTexture(index);
    }
  }
  return cache[index];
}

const ROWS_PER_STEP = 8;

/**
 * Generates missing textures a few rows at a time until `budgetMs` is used up (always at
 * least one step), so idle frames can prepare every terrain before it first appears.
 * Returns true once all textures exist.
 */
export function warmTextures(budgetMs: number): boolean {
  const start = performance.now();
  do {
    if (!partial) {
      const index = TERRAINS.findIndex((_, i) => !cache[i]);
      if (index < 0) return true;
      partial = { index, data: new Uint8ClampedArray(TEX_PX * TEX_PX * 3), row: 0 };
    }
    const end = Math.min(TEX_PX, partial.row + ROWS_PER_STEP);
    generateRows(partial.index, partial.data, partial.row, end);
    partial.row = end;
    if (end === TEX_PX) {
      cache[partial.index] = partial.data;
      partial = null;
    }
  } while (performance.now() - start < budgetMs);
  return TERRAINS.every((_, i) => cache[i]);
}

/** Texture colour at a world pixel (textures repeat every TEX_PX). */
export function texel(index: number, wx: number, wy: number): RGB {
  const t = getTexture(index);
  const o = ((wy & MASK) * TEX_PX + (wx & MASK)) * 3;
  return [t[o], t[o + 1], t[o + 2]];
}

/** Mean colour of a terrain texture (minimap). */
export function averageRGB(index: number): RGB {
  if (!averages[index]) {
    const t = getTexture(index);
    const sum = [0, 0, 0];
    for (let i = 0; i < t.length; i += 3) for (let c = 0; c < 3; c++) sum[c] += t[i + c];
    const n = t.length / 3;
    averages[index] = [Math.round(sum[0] / n), Math.round(sum[1] / n), Math.round(sum[2] / n)];
  }
  return averages[index];
}

/** How many terrain textures have been generated so far (debug / startup checks). */
export function texturesGenerated(): number {
  return cache.filter(Boolean).length;
}
