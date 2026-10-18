import type { BuildingDef } from '../../data/buildings';
import { materialTexel } from '../materials';
import { T, fill, hex, rect, scale } from './draw';

const WATER = hex('#1c2e48');
const WATER_LIGHT = hex('#4a6a90');
const POST = hex('#5a3a22');

/** Well: round stone rim around dark water, two wooden posts and a small shingle roof. */
export function paintWell(out: Uint8ClampedArray, def: BuildingDef, ox: number, oy: number) {
  const x0 = ox * T;
  const y0 = oy * T;
  const W = def.w * T;
  const H = def.h * T;
  const cx = x0 + W / 2;
  const cy = y0 + H / 2 + 4;
  const ro = T * 0.75;
  const ri = T * 0.5;

  // Shadow.
  fill(
    out,
    cx - ro,
    cy - ro + 6,
    cx + ro + 6,
    cy + ro + 8,
    (x, y) => (x - cx - 4) ** 2 + (y - cy - 6) ** 2 <= ro * ro,
    () => [0, 0, 0],
    0.3,
  );

  // Rim (lit top-left) and water.
  fill(
    out,
    cx - ro,
    cy - ro,
    cx + ro,
    cy + ro,
    (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= ro * ro,
    (x, y) => {
      const lit = -(x + 0.5 - cx + (y + 0.5 - cy)) / (ro * 1.4);
      return scale(materialTexel('stone', x, y), 0.95 + 0.3 * lit);
    },
  );
  fill(
    out,
    cx - ri,
    cy - ri,
    cx + ri,
    cy + ri,
    (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= ri * ri,
    (x, y) => {
      const glint =
        Math.abs(Math.hypot(x + 0.5 - cx + 3, y + 0.5 - cy + 3) - ri * 0.55) < 1 &&
        x < cx &&
        y < cy;
      return glint ? WATER_LIGHT : WATER;
    },
  );

  // Posts and roof.
  const postTop = Math.round(cy - T * 0.95);
  for (const px of [Math.round(cx - T * 0.85), Math.round(cx + T * 0.85) - 4]) {
    rect(out, px, postTop, 4, Math.round(cy + T * 0.3) - postTop, (x) =>
      scale(POST, x === px ? 1.2 : 0.85),
    );
  }
  const rt = Math.round(cy - T * 1.3);
  const rb = Math.round(cy - T * 0.8);
  const rl = Math.round(cx - T * 1.05);
  const rw = Math.round(T * 2.1);
  rect(out, rl, rt, rw, rb - rt, (x, y) => {
    const ridge = rt + Math.round((rb - rt) * 0.45);
    const edge = x === rl || x === rl + rw - 1 || y === rt || y === rb - 1;
    const f = edge ? 0.4 : y < ridge ? 1.15 : 0.75;
    return scale(materialTexel('shingle', x, y), f);
  });
}
