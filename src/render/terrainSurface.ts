import { TILE_PX } from '../config';
import type { RGB } from './color';
import { fbm } from './texnoise';
import { TEX_PX, getTexture } from './textures';

/** Terrain index of a world tile. */
export type TerrainLookup = (tx: number, ty: number) => number;

const MASK = TEX_PX - 1;
const NOISE_PX = 256;
const NOISE_MASK = NOISE_PX - 1;

let noiseTable: Float32Array | null = null;

/** Tileable blend noise table (one shared table, offset per terrain). */
function ensureNoise(): void {
  if (noiseTable) return;
  noiseTable = new Float32Array(NOISE_PX * NOISE_PX);
  for (let y = 0; y < NOISE_PX; y++) {
    for (let x = 0; x < NOISE_PX; x++) {
      noiseTable[y * NOISE_PX + x] = fbm(x / NOISE_PX, y / NOISE_PX, 8, 3, 4242);
    }
  }
}

/** The current blend cell: the four tiles around a square between tile centres. */
const cell = {
  uniform: true,
  n: 0,
  tex: [] as Uint8ClampedArray[],
  /** Which weight slot each corner (00, 10, 01, 11) feeds. */
  slot: [0, 0, 0, 0],
  /** Per-slot blend-noise offsets, so each terrain's border wobbles differently. */
  nx: [0, 0, 0, 0],
  ny: [0, 0, 0, 0],
};
const w = new Float64Array(4);

/** Resolves textures, de-duplicated terrains and noise offsets once per cell. */
function prepareCell(t00: number, t10: number, t01: number, t11: number): void {
  ensureNoise();
  cell.uniform = t00 === t10 && t00 === t01 && t00 === t11;
  cell.n = 0;
  const corners = [t00, t10, t01, t11];
  const ids: number[] = [];
  for (let c = 0; c < 4; c++) {
    let k = ids.indexOf(corners[c]);
    if (k < 0) {
      k = ids.length;
      ids.push(corners[c]);
      cell.tex[k] = getTexture(corners[c]);
      cell.nx[k] = 97 * corners[c];
      cell.ny[k] = 53 * corners[c];
    }
    cell.slot[c] = k;
  }
  cell.n = ids.length;
}

/** Colour of one pixel of the prepared cell; (fx, fy) is its position between tile centres. */
function blendCellPixel(
  wx: number,
  wy: number,
  fx: number,
  fy: number,
  out: Uint8ClampedArray,
  o: number,
): void {
  const ti = ((wy & MASK) * TEX_PX + (wx & MASK)) * 3;
  if (cell.uniform) {
    const tex = cell.tex[0];
    out[o] = tex[ti];
    out[o + 1] = tex[ti + 1];
    out[o + 2] = tex[ti + 2];
    return;
  }
  const n = cell.n;
  for (let k = 0; k < n; k++) w[k] = 0;
  w[cell.slot[0]] += (1 - fx) * (1 - fy);
  w[cell.slot[1]] += fx * (1 - fy);
  w[cell.slot[2]] += (1 - fx) * fy;
  w[cell.slot[3]] += fx * fy;
  const table = noiseTable as Float32Array;
  let total = 0;
  for (let k = 0; k < n; k++) {
    const noise =
      table[((wy + cell.ny[k]) & NOISE_MASK) * NOISE_PX + ((wx + cell.nx[k]) & NOISE_MASK)];
    const s = w[k] * (0.35 + 1.3 * noise);
    w[k] = s * s * s; // sharpen (power 3): narrower, crisper borders
    total += w[k];
  }
  let r = 0;
  let g = 0;
  let b = 0;
  for (let k = 0; k < n; k++) {
    const tex = cell.tex[k];
    const f = w[k] / total;
    r += tex[ti] * f;
    g += tex[ti + 1] * f;
    b += tex[ti + 2] * f;
  }
  out[o] = r;
  out[o + 1] = g;
  out[o + 2] = b;
}

/** Fractional position of a world pixel between tile centres: [tile, fraction]. */
function cellCoord(v: number): [number, number] {
  const u = (v + 0.5) / TILE_PX - 0.5;
  const t = Math.floor(u);
  return [t, u - t];
}

/**
 * Writes the RGB colour of world pixel (wx, wy) to out[o..o+2]. A pure function of world
 * position: the four nearest tile centres give bilinear weights per terrain, which are
 * scaled by per-terrain noise and sharpened into an organic border about one tile wide.
 */
export function writeTerrainColor(
  wx: number,
  wy: number,
  terrainAt: TerrainLookup,
  out: Uint8ClampedArray,
  o: number,
): void {
  const [tx, fx] = cellCoord(wx);
  const [ty, fy] = cellCoord(wy);
  prepareCell(
    terrainAt(tx, ty),
    terrainAt(tx + 1, ty),
    terrainAt(tx, ty + 1),
    terrainAt(tx + 1, ty + 1),
  );
  blendCellPixel(wx, wy, fx, fy, out, o);
}

/**
 * Fills a rectangle of an RGBA buffer (`stride` pixels wide) with terrain for world pixels
 * starting at (wx0, wy0). Works cell by cell (the square between four tile centres), so
 * uniform cells are a plain texture copy and only border cells pay for blending. Produces
 * exactly the same pixels as writeTerrainColor.
 */
export function fillTerrainRect(
  wx0: number,
  wy0: number,
  width: number,
  height: number,
  terrainAt: TerrainLookup,
  out: Uint8ClampedArray,
  stride: number,
): void {
  const [cx0] = cellCoord(wx0);
  const [cy0] = cellCoord(wy0);
  const [cx1] = cellCoord(wx0 + width - 1);
  const [cy1] = cellCoord(wy0 + height - 1);
  const half = TILE_PX / 2;
  for (let cy = cy0; cy <= cy1; cy++) {
    // World pixels belonging to this cell row: [cy*T + T/2, (cy+1)*T + T/2).
    const ya = Math.max(wy0, cy * TILE_PX + half);
    const yb = Math.min(wy0 + height, (cy + 1) * TILE_PX + half);
    for (let cx = cx0; cx <= cx1; cx++) {
      const xa = Math.max(wx0, cx * TILE_PX + half);
      const xb = Math.min(wx0 + width, (cx + 1) * TILE_PX + half);
      prepareCell(
        terrainAt(cx, cy),
        terrainAt(cx + 1, cy),
        terrainAt(cx, cy + 1),
        terrainAt(cx + 1, cy + 1),
      );
      if (cell.uniform) {
        // Fast path: straight texture copy.
        const tex = cell.tex[0];
        for (let wy = ya; wy < yb; wy++) {
          const row = (wy - wy0) * stride;
          const trow = (wy & MASK) * TEX_PX;
          for (let wx = xa; wx < xb; wx++) {
            const o = (row + (wx - wx0)) * 4;
            const ti = (trow + (wx & MASK)) * 3;
            out[o] = tex[ti];
            out[o + 1] = tex[ti + 1];
            out[o + 2] = tex[ti + 2];
            out[o + 3] = 255;
          }
        }
        continue;
      }
      for (let wy = ya; wy < yb; wy++) {
        const fy = (wy + 0.5) / TILE_PX - 0.5 - cy;
        const row = (wy - wy0) * stride;
        for (let wx = xa; wx < xb; wx++) {
          const o = (row + (wx - wx0)) * 4;
          blendCellPixel(wx, wy, (wx + 0.5) / TILE_PX - 0.5 - cx, fy, out, o);
          out[o + 3] = 255;
        }
      }
    }
  }
}

export function terrainColorAt(wx: number, wy: number, terrainAt: TerrainLookup): RGB {
  const c = new Uint8ClampedArray(3);
  writeTerrainColor(wx, wy, terrainAt, c, 0);
  return [c[0], c[1], c[2]];
}
