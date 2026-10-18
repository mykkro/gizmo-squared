import type { BuildingDef } from '../../data/buildings';
import { materialTexel } from '../materials';
import { T, dropShadow, fill, hex, rect, scale } from './draw';

const PILLAR = hex('#b0342a');
const ROOF = hex('#3f6e6a');
const INTERIOR = hex('#2c2420');
const LANTERN_LIGHT = hex('#ffd67a');

/**
 * Small shrine: a paved stone platform with front steps, a little hall with red pillars
 * under a roof with curved, upturned eaves, and a stone lantern beside it.
 */
export function paintShrine(out: Uint8ClampedArray, def: BuildingDef, ox: number, oy: number) {
  const x0 = ox * T;
  const y0 = oy * T;
  const W = def.w * T;
  const H = def.h * T;
  const bottom = y0 + H;

  dropShadow(out, x0 + 4, y0 + 4, W - 8, H - 8);

  // Platform and steps.
  rect(out, x0 + 2, y0 + 2, W - 4, H - 4, (x, y) => {
    const edge = x < x0 + 4 || y < y0 + 4 || x >= x0 + W - 4 || y >= bottom - 4;
    return scale(materialTexel('paving', x, y), edge ? 0.8 : 1);
  });
  for (let s = 0; s < 3; s++) {
    const sy = bottom - 4 - (3 - s) * 3;
    rect(out, x0 + W / 2 - 14 + s * 2, sy, 28 - s * 4, 3, (x, y) =>
      scale(materialTexel('stone', x, y), y === sy ? 1.15 : 0.9),
    );
  }

  // Hall: dark interior between two red pillars.
  const hl = x0 + Math.round(T * 0.6);
  const hr = x0 + W - Math.round(T * 0.6);
  const hallTop = y0 + Math.round(T * 1.35);
  const hallBottom = bottom - Math.round(T * 0.5);
  rect(out, hl, hallTop, hr - hl, hallBottom - hallTop, () => INTERIOR);
  for (const px of [hl, hr - 5]) {
    rect(out, px, hallTop, 5, hallBottom - hallTop, (x) =>
      scale(PILLAR, x === px ? 1.2 : x === px + 4 ? 0.7 : 1),
    );
  }

  // Roof with curved, upturned eaves (wider at the bottom, tips curling up).
  const rt = y0 + Math.round(T * 0.25);
  const rb = hallTop + 4;
  const cx = x0 + W / 2;
  const base = (hr - hl) / 2 + 10;
  fill(
    out,
    cx - base - 4,
    rt - 4,
    cx + base + 4,
    rb,
    (x, y) => {
      const k = (y - rt) / (rb - rt);
      const hw = base * (0.45 + 0.55 * k * k) + (k > 0.8 ? (k - 0.8) * 30 : 0);
      return y >= rt && Math.abs(x - cx) <= hw;
    },
    (x, y) => {
      const k = (y + 0.5 - rt) / (rb - rt);
      const f = k < 0.12 ? 1.35 : k > 0.88 ? 0.55 : 1.15 - 0.4 * k;
      return scale(ROOF, f * (0.95 + 0.1 * ((x + y) % 3 === 0 ? 1 : 0)));
    },
  );

  // Stone lantern at the front-right corner.
  const lx = x0 + W - Math.round(T * 0.55);
  const ly = bottom - Math.round(T * 0.35);
  const stone = (x: number, y: number, f: number) => scale(materialTexel('stone', x, y), f);
  rect(out, lx - 4, ly - 3, 8, 3, (x, y) => stone(x, y, 1)); // base
  rect(out, lx - 1, ly - 10, 3, 7, (x, y) => stone(x, y, 0.9)); // post
  rect(out, lx - 4, ly - 16, 8, 6, (x, y) =>
    x > lx - 3 && x < lx + 3 && y > ly - 15 && y < ly - 11 ? LANTERN_LIGHT : stone(x, y, 1.05),
  );
  rect(out, lx - 5, ly - 19, 10, 3, (x, y) => stone(x, y, x < lx ? 1.25 : 0.8)); // cap
}
