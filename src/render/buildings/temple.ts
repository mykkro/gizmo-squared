import type { BuildingDef } from '../../data/buildings';
import { materialTexel } from '../materials';
import { T, dropShadow, fill, hex, put, rect, scale } from './draw';

const INTERIOR = hex('#3a332c');

/**
 * Ancient temple: stepped marble platform along the front, a colonnade of fluted columns
 * in front of a dark interior, an entablature with a pediment, and a gently lit roof.
 */
export function paintTemple(out: Uint8ClampedArray, def: BuildingDef, ox: number, oy: number) {
  const x0 = ox * T;
  const y0 = oy * T;
  const W = def.w * T;
  const H = def.h * T;
  const bottom = y0 + H;
  const marble = (x: number, y: number, f = 1) => scale(materialTexel('marble', x, y), f);

  dropShadow(out, x0, y0, W, H - Math.round(T * 0.5));

  // Three steps (the walkable front row).
  const stepH = Math.round(T * 0.17);
  const stepsTop = bottom - stepH * 3;
  for (let s = 0; s < 3; s++) {
    const inset = (2 - s) * 3;
    const sy = stepsTop + s * stepH;
    rect(out, x0 + inset - 6, sy, W - 2 * inset + 12, stepH, (x, y) =>
      marble(x, y, y === sy ? 1.1 : y >= sy + stepH - 2 ? 0.72 : 0.95),
    );
  }

  // Colonnade: dark interior behind a row of columns.
  const colBottom = stepsTop - 4;
  const colTop = stepsTop - Math.round(T * 1.25);
  rect(out, x0, colTop, W, colBottom - colTop, (_x, y) =>
    scale(INTERIOR, 0.9 + 0.2 * ((y - colTop) / (colBottom - colTop))),
  );
  rect(out, x0 - 4, colBottom, W + 8, 4, (x, y) => marble(x, y, 0.85)); // stylobate
  const n = def.w;
  const cw = Math.round(T * 0.42);
  for (let i = 0; i < n; i++) {
    const ccx = Math.round(x0 + (i + 0.5) * (W / n));
    const cl = ccx - Math.floor(cw / 2);
    rect(out, cl, colTop, cw, colBottom - colTop, (x, y) => {
      const lx = x - cl;
      const ly = y - colTop;
      if (ly < 4) return marble(x, y, 1.05); // capital
      if (ly >= colBottom - colTop - 3) return marble(x, y, 0.95); // base
      const flute = lx % 3 === 2 ? 0.86 : 1;
      const light = lx < 3 ? 1.08 : lx >= cw - 3 ? 0.78 : 1;
      return marble(x, y, flute * light);
    });
    rect(out, cl - 2, colTop, cw + 4, 3, (x, y) => marble(x, y, 1.12)); // abacus
  }

  // Roof behind the pediment.
  const top = y0 - 4;
  const entH = Math.round(T * 0.35);
  const entTop = colTop - entH;
  for (let y = top; y < entTop; y++) {
    for (let x = x0 - 4; x < x0 + W + 4; x++) {
      const edge = x === x0 - 4 || x === x0 + W + 3 || y === top;
      put(
        out,
        x,
        y,
        edge ? marble(x, y, 0.45) : marble(x, y, 1.05 - 0.25 * ((y - top) / (entTop - top))),
      );
    }
  }

  // Entablature with dentils.
  rect(out, x0 - 4, entTop, W + 8, entH, (x, y) => {
    const ly = y - entTop;
    if (ly < 2) return marble(x, y, 1.15);
    if (ly > entH - 5 && (x - x0) % 6 < 3) return marble(x, y, 0.7); // dentils
    return marble(x, y, 0.92);
  });

  // Pediment: a shallow triangle above the entablature.
  const pedH = Math.round(T * 0.7);
  const cx = x0 + W / 2;
  const half = W / 2 + 2;
  fill(
    out,
    cx - half,
    entTop - pedH,
    cx + half,
    entTop,
    (x, y) => Math.abs(x - cx) <= half * ((y - (entTop - pedH)) / pedH),
    (x, y) => {
      const k = (y + 0.5 - (entTop - pedH)) / pedH;
      const rim = Math.abs(x + 0.5 - cx) > half * k - 3 || y >= entTop - 2;
      return marble(x, y, rim ? 1.18 : 0.88);
    },
  );
}
