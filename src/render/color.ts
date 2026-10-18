export type RGB = [number, number, number];

export function parseHex(hex: string): RGB {
  let h = hex.replace(/^#/, '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

export function shade(rgb: RGB, factor: number): RGB {
  const f = (v: number) => Math.min(255, Math.max(0, Math.round(v * factor)));
  return [f(rgb[0]), f(rgb[1]), f(rgb[2])];
}
