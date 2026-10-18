export interface Vec2 {
  x: number;
  y: number;
}

/** Unit-length copy of v, or zero for a zero vector. */
export function normalize(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.y);
  return len === 0 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len };
}
