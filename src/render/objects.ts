import { CHUNK_PX, TILE_PX } from '../config';
import { blockById, type BlockKey } from '../data/blocks';
import { parseHex, shade, type RGB } from './color';
import { rasterize, type RasterImage, type Shape, type SpriteDef } from './sprites';

const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) =>
  ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const css = ([r, g, b]: RGB) => `rgb(${r}, ${g}, ${b})`;
const SHADOW = 'rgba(0, 0, 0, 0.25)';

/** Light from the top-left: 'h' highlight, 'G' shade, else the base key. */
function lit(x: number, y: number, cx: number, cy: number, r: number, base: string): string {
  const light = (-(x - cx) * 0.55 - (y - cy) * 0.83) / r;
  return light > 0.5 ? 'h' : light < -0.45 ? 'G' : base;
}

const tree: SpriteDef = {
  w: 32,
  h: 32,
  palette: {
    g: '#3f8f3a',
    G: '#2a6b2a',
    h: '#7cc66a',
    t: '#7a5230',
    T: '#5a3a20',
    o: '#173d1a',
    s: SHADOW,
  },
  outline: 'o',
  shape: (x, y) => {
    const canopy =
      inEllipse(x, y, 11, 15, 7.5, 7.5) ||
      inEllipse(x, y, 21, 15, 7.5, 7.5) ||
      inEllipse(x, y, 16, 9.5, 8.5, 8.5);
    if (canopy) return lit(x, y, 16, 12, 11, 'g');
    if (x >= 14 && x <= 18 && y >= 19 && y <= 28.5) return x > 16.8 ? 'T' : 't';
    return null;
  },
  under: (x, y) => (inEllipse(x, y, 17, 28.5, 10, 3) ? 's' : null),
};

const boulder: SpriteDef = {
  w: 32,
  h: 32,
  palette: { r: '#8a8580', G: '#625d58', h: '#bdb8b2', o: '#3a3836', s: SHADOW },
  outline: 'o',
  shape: (x, y) =>
    inEllipse(x, y, 15, 18, 11.5, 9) || inEllipse(x, y, 21, 15, 6.5, 5.5)
      ? lit(x, y, 16, 16, 11, 'r')
      : null,
  under: (x, y) => (inEllipse(x, y, 17, 26.5, 12, 3.2) ? 's' : null),
};

const cactusShape: Shape = (x, y) => {
  const body = (Math.abs(x - 16) < 3.5 && y >= 7.5 && y <= 28) || inEllipse(x, y, 16, 7.5, 3.5, 3);
  const left =
    (x >= 8 && x <= 13 && y >= 15 && y <= 18.5) ||
    (x >= 8 && x <= 11 && y >= 10.5 && y <= 18.5) ||
    inEllipse(x, y, 9.5, 10.5, 1.5, 1.5);
  const right =
    (x >= 19 && x <= 24 && y >= 12 && y <= 15.5) ||
    (x >= 21 && x <= 24 && y >= 8 && y <= 15.5) ||
    inEllipse(x, y, 22.5, 8, 1.5, 1.5);
  if (!body && !left && !right) return null;
  const local = body ? x - 16 : left ? x - 9.5 : x - 22.5;
  return local < -1.2 ? 'h' : local > 1.2 ? 'G' : 'c';
};

const cactus: SpriteDef = {
  w: 32,
  h: 32,
  palette: { c: '#4f9a3c', G: '#357a28', h: '#86cf6a', o: '#1d4a14', s: SHADOW },
  outline: 'o',
  shape: cactusShape,
  under: (x, y) => (inEllipse(x, y, 17, 28.5, 8, 2.5) ? 's' : null),
};

/** A bevelled, rounded block in the given colour (building parts). */
function brick(color: string): SpriteDef {
  const base = parseHex(color);
  return {
    w: 32,
    h: 32,
    palette: {
      b: css(base),
      h: css(shade(base, 1.3)),
      G: css(shade(base, 0.7)),
      o: css(shade(base, 0.45)),
    },
    outline: 'o',
    shape: (x, y) => {
      const dx = Math.max(Math.abs(x - 16) - 10.5, 0);
      const dy = Math.max(Math.abs(y - 16) - 10.5, 0);
      if (dx * dx + dy * dy > 16) return null; // rounded rectangle, radius 4
      if (x < 5 || y < 5) return 'h';
      if (x > 27 || y > 27) return 'G';
      return 'b';
    },
  };
}

const SPECIAL: Partial<Record<BlockKey, SpriteDef>> = { tree, boulder, cactus };
const images = new Map<number, RasterImage>();

function blockImage(id: number): RasterImage | null {
  const b = blockById(id);
  if (!b) return null;
  let img = images.get(id);
  if (!img) {
    img = rasterize(SPECIAL[b.key] ?? brick(b.color), TILE_PX / 32);
    images.set(id, img);
  }
  return img;
}

/** Composites a block's anti-aliased image over the tile at (ox, oy) in a CHUNK_PX-wide buffer. */
export function paintBlock(id: number, out: Uint8ClampedArray, ox: number, oy: number): void {
  const img = blockImage(id);
  if (!img) return;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const s = (y * img.width + x) * 4;
      const a = img.data[s + 3] / 255;
      if (a === 0) continue;
      const o = ((oy + y) * CHUNK_PX + ox + x) * 4;
      for (let c = 0; c < 3; c++) out[o + c] = img.data[s + c] * a + out[o + c] * (1 - a);
    }
  }
}
