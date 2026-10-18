import type { ItemKey } from '../data/items';
import { parseHex } from './color';

/** A pixel sprite: each char in `rows` is a palette key, '.' is transparent. */
export interface PixelSprite {
  w: number;
  h: number;
  palette: Record<string, string>;
  rows: readonly string[];
}

export function spriteErrors(s: PixelSprite): string[] {
  const errors: string[] = [];
  if (s.rows.length !== s.h) errors.push(`expected ${s.h} rows, got ${s.rows.length}`);
  s.rows.forEach((row, i) => {
    if (row.length !== s.w) errors.push(`row ${i} has ${row.length} columns`);
    for (const ch of row) {
      if (ch !== '.' && !(ch in s.palette)) errors.push(`row ${i}: unknown '${ch}'`);
    }
  });
  return errors;
}

export function spriteToCanvas(s: PixelSprite): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = s.w;
  canvas.height = s.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  s.rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      ctx.fillStyle = s.palette[ch];
      ctx.fillRect(x, y, 1, 1);
    });
  });
  return canvas;
}

/** Palette key at point (x, y) in sprite units, or null for empty. */
export type Shape = (x: number, y: number) => string | null;

/**
 * A sprite defined by shapes in sprite units (w x h). It can be rasterised as pixel art
 * (paintDef) or at any screen scale with anti-aliasing (rasterize).
 */
export interface SpriteDef {
  w: number;
  h: number;
  palette: Record<string, string>;
  /** Palette key drawn in a 1-unit band around everything the shape covers. */
  outline: string;
  shape: Shape;
  /** Fills what is still empty after the outline (e.g. a soft drop shadow). */
  under?: Shape;
}

const def = (
  w: number,
  h: number,
  palette: Record<string, string>,
  outline: string,
  shape: Shape,
  under?: Shape,
): SpriteDef => ({ w, h, palette, outline, shape, under });

const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) =>
  ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

/** Rasterises a definition as pixel art: one sample per pixel centre, 1 px outline. */
export function paintDef(d: SpriteDef): PixelSprite {
  const { w, h, palette, outline, shape, under } = d;
  const grid = Array.from({ length: h }, (_, y) =>
    Array.from({ length: w }, (_, x) => shape(x + 0.5, y + 0.5)),
  );
  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && !!grid[y][x];
  const rows = grid.map((row, y) =>
    row
      .map((c, x) => {
        if (c) return c;
        if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) {
          return outline;
        }
        return under?.(x + 0.5, y + 0.5) ?? '.';
      })
      .join(''),
  );
  return { w, h, palette, rows };
}

// ---------------------------------------------------------------------------------------
// Gizmo (32 x 32)

const GIZMO_PALETTE = {
  k: '#1d2b2a', // outline, mouth, closed eyes, antenna stalk
  g: '#5fd16b', // body
  G: '#3a9c4a', // body shade, upper feet
  h: '#a8f0a0', // body highlight
  b: '#7fe08a', // belly panel
  F: '#2c7a3a', // feet underside
  w: '#ffffff',
  e: '#1d2b2a', // pupils
  a: '#ffd23f', // antenna bulb
  A: '#fff6c4', // antenna bulb highlight
  c: '#ff8fa3', // cheeks
  s: 'rgba(0, 0, 0, 0.28)', // drop shadow
};

const BODY = { cx: 16, cy: 17, rx: 11.5, ry: 10 };

function gizmoShape(legsApart: boolean, eyesOpen: boolean): Shape {
  const feet = legsApart
    ? [
        [9.5, 27],
        [22.5, 28],
      ]
    : [
        [11, 27.5],
        [21, 27.5],
      ];
  return (x, y) => {
    // Antenna: glowing bulb on a stalk.
    if (inEllipse(x, y, 16, 3.5, 1.9, 1.9)) return x < 15.8 && y < 3.3 ? 'A' : 'a';
    if (Math.abs(x - 16) < 0.6 && y > 5 && y < 7.2) return 'k';

    for (const [fx, fy] of feet) {
      if (inEllipse(x, y, fx, fy, 3.2, 1.9)) return y < fy ? 'G' : 'F';
    }

    if (!inEllipse(x, y, BODY.cx, BODY.cy, BODY.rx, BODY.ry)) return null;

    for (const ex of [11.5, 20.5]) {
      if (eyesOpen && inEllipse(x, y, ex, 15, 2.6, 3.2)) {
        if (Math.abs(x - ex) < 0.6 && Math.abs(y - 14.5) < 0.6) return 'w'; // catch-light
        return inEllipse(x, y, ex + 0.7, 15.7, 1.5, 1.9) ? 'e' : 'w';
      }
      if (!eyesOpen && Math.abs(y - 15.5) < 0.6 && Math.abs(x - ex) < 2.6) return 'k';
    }

    if (inEllipse(x, y, 8.5, 19.5, 1.8, 1.2) || inEllipse(x, y, 23.5, 19.5, 1.8, 1.2)) return 'c';

    // Smile: a short line with raised corners.
    if (Math.abs(y - 21.5) < 0.6 && Math.abs(x - 16) < 1.6) return 'k';
    if (Math.abs(y - 20.5) < 0.6 && Math.abs(Math.abs(x - 16) - 2) < 0.6) return 'k';

    if (inEllipse(x, y, 16, 23.5, 5, 2.2)) return 'b';

    // Light from the top-left.
    const nx = (x - BODY.cx) / BODY.rx;
    const ny = (y - BODY.cy) / BODY.ry;
    const light = -0.55 * nx - 0.83 * ny;
    const r2 = nx * nx + ny * ny;
    if (light > 0.55 && r2 > 0.6 && r2 < 0.92) return 'h'; // rim highlight
    if (light < -0.55) return 'G';
    return 'g';
  };
}

const gizmoShadow: Shape = (x, y) => (inEllipse(x, y, 16, 29.6, 8.5, 1.6) ? 's' : null);

const gizmo = (legsApart: boolean, eyesOpen: boolean) =>
  def(32, 32, GIZMO_PALETTE, 'k', gizmoShape(legsApart, eyesOpen), gizmoShadow);

export const GIZMO_DEFS = {
  walk: [gizmo(false, true), gizmo(true, true)] as readonly SpriteDef[],
  tired: gizmo(false, false),
};

/** Bottom row of Gizmo's feet; the renderer puts the row below it on the player's y. */
export const GIZMO_FEET_ROW = 29;
export const GIZMO_FRAMES: readonly PixelSprite[] = GIZMO_DEFS.walk.map(paintDef);
export const GIZMO_TIRED: PixelSprite = paintDef(GIZMO_DEFS.tired);

// ---------------------------------------------------------------------------------------
// Items (16 x 16)

function berry(r: string, d: string, h: string, o: string, sparkle = false): SpriteDef {
  const shape: Shape = (x, y) => {
    if (inEllipse(x, y, 10.8, 2.6, 2.3, 1.1)) return 'l';
    if (Math.abs(x - 8) < 0.6 && y > 1.5 && y < 4.5) return 's';
    if (!inEllipse(x, y, 8, 9.5, 5.6, 5.4)) return null;
    if (inEllipse(x, y, 6, 7.5, 1.3, 1.1)) return 'h';
    return 0.6 * ((x - 8) / 5.6) + 0.8 * ((y - 9.5) / 5.4) > 0.45 ? 'd' : 'r';
  };
  const twinkle: Shape = (x, y) =>
    sparkle && (inEllipse(x, y, 1.5, 2.5, 0.7, 0.7) || inEllipse(x, y, 14.5, 13.5, 0.7, 0.7))
      ? 'y'
      : null;
  return def(16, 16, { l: '#3fa34d', s: '#6b4a26', y: '#fff8d0', r, d, h, o }, 'o', shape, twinkle);
}

const zoomLeaf = def(
  16,
  16,
  { l: '#3fd0c9', d: '#1e8f8a', h: '#a6f2ec', o: '#0f4f4c' },
  'o',
  (x, y) => {
    const u = (x - 8 + (y - 8)) / Math.SQRT2;
    const v = (x - 8 - (y - 8)) / Math.SQRT2;
    if (u > 5 && u < 7.6 && Math.abs(v) < 0.6) return 'd'; // stem
    if ((u / 5.6) ** 2 + (v / 2.8) ** 2 > 1) return null;
    if (Math.abs(v) < 0.5) return 'd'; // midrib
    return v < -0.9 ? 'h' : 'l';
  },
);

const magnetPetal = def(
  16,
  16,
  { p: '#b46ee8', P: '#d9a8ff', y: '#ffe066', Y: '#fff6c4', o: '#4b2270' },
  'o',
  (x, y) => {
    if (inEllipse(x, y, 8, 8, 2.1, 2.1)) return x < 7.6 && y < 7.6 ? 'Y' : 'y';
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
      const cx = 8 + Math.cos(a) * 3.9;
      const cy = 8 + Math.sin(a) * 3.9;
      if (inEllipse(x, y, cx, cy, 2.6, 2.6)) return y < cy - 0.8 ? 'P' : 'p';
    }
    return null;
  },
);

const sapDrop = def(
  16,
  16,
  { a: '#d98a1c', b: '#a35f08', h: '#ffd28a', o: '#5a3304' },
  'o',
  (x, y) => {
    const inBall = inEllipse(x, y, 8, 10, 4.6, 4.4);
    const inTip = y >= 2.5 && y < 10 && Math.abs(x - 8) < (y - 2.5) * 0.62;
    if (!inBall && !inTip) return null;
    if (inEllipse(x, y, 6.3, 9.3, 1.1, 1.6)) return 'h';
    return (x - 8) * 0.5 + (y - 10) * 0.8 > 2.2 ? 'b' : 'a';
  },
);

export const ITEM_DEFS: Record<ItemKey, SpriteDef> = {
  berry: berry('#e5484d', '#a3242a', '#ffb3b5', '#5a1418'),
  golden: berry('#f5b82e', '#b07a12', '#fff1b8', '#5c3d05', true),
  sour: berry('#9bd13b', '#5e8a1c', '#e2f7b5', '#2f4a0c'),
  zoom: zoomLeaf,
  magnet: magnetPetal,
  sap: sapDrop,
};

export const ITEM_SPRITES = Object.fromEntries(
  Object.entries(ITEM_DEFS).map(([k, d]) => [k, paintDef(d)]),
) as Record<ItemKey, PixelSprite>;

// ---------------------------------------------------------------------------------------
// HD rasteriser

type RGBA = [number, number, number, number];

/** Parses '#rgb', '#rrggbb' or 'rgba(r, g, b, a)'. */
function parseColor(c: string): RGBA {
  const m = /^rgba?\(([^)]+)\)$/.exec(c);
  if (m) {
    const [r, g, b, a = 1] = m[1].split(',').map(Number);
    return [r, g, b, a];
  }
  const [r, g, b] = parseHex(c);
  return [r, g, b, 1];
}

export interface RasterImage {
  width: number;
  height: number;
  /** Straight (non-premultiplied) RGBA. */
  data: Uint8ClampedArray;
}

const OUTLINE_DIRS = Array.from({ length: 8 }, (_, i) => [
  Math.cos((i * Math.PI) / 4),
  Math.sin((i * Math.PI) / 4),
]);
const SUB = 2;

/** Palette key at a point, including the 1-unit outline band and the under-layer. */
function keyAt(d: SpriteDef, x: number, y: number): string | null {
  const k = d.shape(x, y);
  if (k) return k;
  for (const [dx, dy] of OUTLINE_DIRS) if (d.shape(x + dx, y + dy)) return d.outline;
  return d.under?.(x, y) ?? null;
}

/**
 * Rasterises a sprite at `scale` device pixels per sprite unit with 2x2 supersampling, so
 * edges are anti-aliased and the outline stays about one sprite unit thick at any zoom.
 */
export function rasterize(d: SpriteDef, scale: number): RasterImage {
  const width = Math.ceil(d.w * scale);
  const height = Math.ceil(d.h * scale);
  const colors = new Map(Object.entries(d.palette).map(([k, c]) => [k, parseColor(c)]));
  const data = new Uint8ClampedArray(width * height * 4);
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SUB; sy++) {
        for (let sx = 0; sx < SUB; sx++) {
          const key = keyAt(d, (px + (sx + 0.5) / SUB) / scale, (py + (sy + 0.5) / SUB) / scale);
          const c = key ? colors.get(key) : undefined;
          if (!c) continue;
          r += c[0] * c[3];
          g += c[1] * c[3];
          b += c[2] * c[3];
          a += c[3];
        }
      }
      const o = (py * width + px) * 4;
      if (a > 0) {
        data[o] = r / a;
        data[o + 1] = g / a;
        data[o + 2] = b / a;
        data[o + 3] = (a / (SUB * SUB)) * 255;
      }
    }
  }
  return { width, height, data };
}
