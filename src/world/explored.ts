/** Tiles per fog cell side. The minimap reveals the world in cells of this size. */
export const CELL_TILES = 4;
/** Radius around Gizmo (in tiles) that becomes revealed. */
export const REVEAL_RADIUS_TILES = 12;

/** Cells per region side; each region is stored as one bitset. */
const REGION_CELLS = 64;
const REGION_BYTES = (REGION_CELLS * REGION_CELLS) / 8;
const REGION_KEY = /^-?\d+,-?\d+$/;

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromBase64(text: string): Uint8Array | null {
  try {
    const s = atob(text);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/** Save-data check: `{ "rx,ry": base64 bitset }` with correctly sized regions. */
export function isValidExploredData(o: unknown): o is Record<string, string> {
  if (typeof o !== 'object' || o === null || Array.isArray(o)) return false;
  for (const [key, value] of Object.entries(o)) {
    if (!REGION_KEY.test(key) || typeof value !== 'string') return false;
    if (fromBase64(value)?.length !== REGION_BYTES) return false;
  }
  return true;
}

/** Which parts of the world Gizmo has seen (fog of war), stored compactly per region. */
export class ExploredMap {
  /** Increases whenever new cells are revealed, so views know when to redraw. */
  revision = 0;
  private readonly regions = new Map<string, Uint8Array>();

  static deserialize(data: Record<string, string>): ExploredMap {
    if (!isValidExploredData(data)) throw new Error('Invalid explored-map data');
    const m = new ExploredMap();
    for (const [key, value] of Object.entries(data)) {
      m.regions.set(key, fromBase64(value) as Uint8Array);
    }
    return m;
  }

  serialize(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, bits] of this.regions) out[key] = toBase64(bits);
    return out;
  }

  isCellRevealed(cx: number, cy: number): boolean {
    const [bits, bit] = this.locate(cx, cy, false);
    return !!bits && (bits[bit >> 3] & (1 << (bit & 7))) !== 0;
  }

  isTileRevealed(tx: number, ty: number): boolean {
    return this.isCellRevealed(Math.floor(tx / CELL_TILES), Math.floor(ty / CELL_TILES));
  }

  /** Reveals every cell whose centre lies within `radius` tiles. Returns true if any was new. */
  reveal(tx: number, ty: number, radius = REVEAL_RADIUS_TILES): boolean {
    const px = tx + 0.5;
    const py = ty + 0.5;
    const c0x = Math.floor((px - radius) / CELL_TILES);
    const c1x = Math.floor((px + radius) / CELL_TILES);
    const c0y = Math.floor((py - radius) / CELL_TILES);
    const c1y = Math.floor((py + radius) / CELL_TILES);
    let changed = false;
    for (let cy = c0y; cy <= c1y; cy++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        const dx = (cx + 0.5) * CELL_TILES - px;
        const dy = (cy + 0.5) * CELL_TILES - py;
        if (dx * dx + dy * dy > radius * radius) continue;
        const [bits, bit] = this.locate(cx, cy, true);
        const mask = 1 << (bit & 7);
        if (bits && !(bits[bit >> 3] & mask)) {
          bits[bit >> 3] |= mask;
          changed = true;
        }
      }
    }
    if (changed) this.revision++;
    return changed;
  }

  private locate(cx: number, cy: number, create: boolean): [Uint8Array | undefined, number] {
    const rx = Math.floor(cx / REGION_CELLS);
    const ry = Math.floor(cy / REGION_CELLS);
    const key = `${rx},${ry}`;
    let bits = this.regions.get(key);
    if (!bits && create) {
      bits = new Uint8Array(REGION_BYTES);
      this.regions.set(key, bits);
    }
    const lx = cx - rx * REGION_CELLS;
    const ly = cy - ry * REGION_CELLS;
    return [bits, ly * REGION_CELLS + lx];
  }
}
