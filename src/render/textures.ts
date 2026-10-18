import { hash2 } from '../core/rng';
import { TERRAINS, type TerrainKey } from '../data/terrains';
import { parseHex, type RGB } from './color';
import { cellular, fbm, valueNoise } from './texnoise';

/** Generated texture size in pixels (4 x 4 tiles). Power of two so world coords wrap with &. */
export const TEX_PX = 128;
const MASK = TEX_PX - 1;

type Kind = 'fbm' | 'streaks' | 'ripples' | 'waves' | 'cells' | 'speckle';
type Accent = 'sparkle' | 'glow' | 'algae' | 'litter';

interface Recipe {
  /** Dark to light. */
  palette: string[];
  kind: Kind;
  /** Feature frequency (integer, cells per texture). */
  scale: number;
  accent?: Accent;
}

const RECIPES: Record<TerrainKey, Recipe> = {
  grass: { palette: ['#2f6b22', '#3d7e25', '#4fa836', '#6fc845'], kind: 'streaks', scale: 4 },
  grassland: { palette: ['#5e9e34', '#73b843', '#8fd65a', '#b2ea7e'], kind: 'streaks', scale: 3 },
  forest_floor: {
    palette: ['#2e3a1c', '#3b4a24', '#4a5a2c', '#5f6f3a'],
    kind: 'speckle',
    scale: 6,
    accent: 'litter',
  },
  dirt: { palette: ['#5e3c1c', '#73492a', '#8b5a2b', '#a2703e'], kind: 'fbm', scale: 6 },
  sand: { palette: ['#d9bf7a', '#e8cf8e', '#f2dc9b', '#fbecbf'], kind: 'ripples', scale: 7 },
  snow: {
    palette: ['#cfdde2', '#e2ecef', '#f2f7f7', '#ffffff'],
    kind: 'fbm',
    scale: 3,
    accent: 'sparkle',
  },
  water: { palette: ['#1f5fb8', '#2f7fe0', '#4f98ec', '#8cc2f7'], kind: 'waves', scale: 5 },
  lava: { palette: ['#2a1006', '#4a1a0c', '#6a2610'], kind: 'cells', scale: 5, accent: 'glow' },
  stone: { palette: ['#5a5a5a', '#6d6d6d', '#7d7d7d', '#959595'], kind: 'cells', scale: 4 },
  mud: { palette: ['#3e2914', '#5a3d1f', '#6b4a26', '#7d5a32'], kind: 'fbm', scale: 4 },
  ice: {
    palette: ['#8fc4e2', '#b5dcf2', '#cbe8f8', '#eaf7ff'],
    kind: 'streaks',
    scale: 2,
    accent: 'sparkle',
  },
  swamp: {
    palette: ['#1f4f26', '#2a6131', '#2f7a3a', '#3f8a45'],
    kind: 'fbm',
    scale: 5,
    accent: 'algae',
  },
  rock: { palette: ['#333333', '#474747', '#5c5c5c', '#727272'], kind: 'cells', scale: 3 },
  snowy_dirt: { palette: ['#6f6052', '#a39a90', '#d9d4ce', '#f4f2ee'], kind: 'fbm', scale: 5 },
  volcanic_rock: { palette: ['#221a12', '#3a2e22', '#4a3a2a', '#5e4a36'], kind: 'cells', scale: 4 },
  bog: { palette: ['#30280f', '#4a3e22', '#5a4a2c', '#6a5a36'], kind: 'speckle', scale: 5 },
};

const ACCENT_RGB: Record<Accent, RGB> = {
  sparkle: [255, 255, 255],
  glow: [255, 170, 50],
  algae: [127, 191, 58],
  litter: [107, 74, 38],
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const contrast = (v: number) => clamp01((v - 0.5) * 1.8 + 0.5);

function paletteAt(stops: RGB[], v: number): RGB {
  const pos = clamp01(v) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(pos));
  const t = pos - i;
  const a = stops[i];
  const b = stops[i + 1];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Shade value (0..1) and accent strength (0..1) of one texture pixel. */
function sample(r: Recipe, seed: number, px: number, py: number): [number, number] {
  const x = px / TEX_PX;
  const y = py / TEX_PX;
  const s = r.scale;
  let v: number;
  let accent = 0;
  switch (r.kind) {
    case 'fbm':
      v = contrast(fbm(x, y, s, 4, seed));
      break;
    case 'streaks':
      // Fast variation across x, slow along y: blades / streaks.
      v = contrast(0.45 * fbm(x, y, s, 3, seed) + 0.55 * valueNoise(x, y, s * 12, s * 2, seed + 7));
      break;
    case 'ripples': {
      const warp = 0.35 * fbm(x, y, 3, 3, seed + 3);
      const band = Math.sin(2 * Math.PI * (y * s + warp));
      v = clamp01(0.55 + 0.25 * band + 0.25 * (valueNoise(x, y, 32, 32, seed + 5) - 0.5));
      break;
    }
    case 'waves': {
      const warp = 0.6 * fbm(x, y, 3, 3, seed + 3);
      const band = Math.sin(2 * Math.PI * (x * 2 + y * s + warp));
      v = clamp01(0.45 + 0.2 * band + 0.3 * (fbm(x, y, 4, 3, seed) - 0.5));
      if (band > 0.93) accent = 0.35;
      break;
    }
    case 'cells': {
      const c = cellular(x, y, s, seed);
      v = clamp01(0.5 * contrast(fbm(x, y, 8, 3, seed + 1)) + 0.5 * (1 - Math.min(1, c.f1)));
      const edge = c.f2 - c.f1;
      if (edge < 0.08) {
        if (r.accent === 'glow') accent = 1 - edge / 0.08;
        else v *= 0.35 + (edge / 0.08) * 0.5;
      }
      break;
    }
    case 'speckle': {
      v = contrast(fbm(x, y, s, 4, seed));
      const c = cellular(x, y, s * 3, seed + 2);
      if (c.f1 < 0.16) v = clamp01(v + 0.25);
      break;
    }
  }
  switch (r.accent) {
    case 'sparkle':
      if (hash2(seed, px, py, 9) < 0.006) accent = 0.85;
      break;
    case 'algae':
      if (cellular(x, y, s * 2, seed + 4).f1 < 0.2) accent = 0.55;
      break;
    case 'litter':
      if (cellular(x, y, s * 4, seed + 6).f1 < 0.12) accent = 0.6;
      break;
  }
  return [v, accent];
}

function generate(index: number): Uint8ClampedArray {
  const r = RECIPES[TERRAINS[index].key];
  const stops = r.palette.map(parseHex);
  const accentRGB =
    r.kind === 'waves' ? ([230, 245, 255] as RGB) : ACCENT_RGB[r.accent ?? 'sparkle'];
  const seed = 1000 + index * 17;
  const out = new Uint8ClampedArray(TEX_PX * TEX_PX * 3);
  for (let py = 0; py < TEX_PX; py++) {
    for (let px = 0; px < TEX_PX; px++) {
      const [v, a] = sample(r, seed, px, py);
      const base = paletteAt(stops, v);
      const o = (py * TEX_PX + px) * 3;
      for (let c = 0; c < 3; c++) out[o + c] = base[c] + (accentRGB[c] - base[c]) * a;
    }
  }
  return out;
}

const cache: Uint8ClampedArray[] = [];
const averages: RGB[] = [];

/** RGB texture (TEX_PX² x 3) of a terrain, generated on first use. */
export function getTexture(index: number): Uint8ClampedArray {
  return (cache[index] ??= generate(index));
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
