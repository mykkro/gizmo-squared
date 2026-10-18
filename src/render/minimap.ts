import { LruCache } from '../core/lru';
import { TERRAINS } from '../data/terrains';
import type { ExploredMap } from '../world/explored';
import type { World } from '../world/World';
import { parseHex, type RGB } from './color';

/** Minimap size in map pixels (square). */
export const MAP_PX = 160;
/** World tiles covered by one map pixel (one sample per pixel). */
export const TILES_PER_MAP_PX = 2;
/** Map pixels per cached block side. */
export const BLOCK_PX = 32;
/** Colour of unexplored areas. */
export const FOG_RGB: RGB = [20, 24, 28];

const BLOCK_CACHE_LIMIT = 64;
const BLOCKS_PER_COMPOSE = 1;
const TERRAIN_RGB: RGB[] = TERRAINS.map((t) => parseHex(t.color));

/** Terrain index of a world tile. */
export type TerrainSampler = (tx: number, ty: number) => number;

/**
 * Builds the minimap image: terrain sampled into cached blocks (at most one new block per
 * compose, so moving never stalls a frame), masked by the explored map.
 */
export class MinimapModel {
  private readonly blocks = new LruCache<string, Uint8Array>(BLOCK_CACHE_LIMIT);

  constructor(
    private readonly sample: TerrainSampler,
    private readonly explored: ExploredMap,
  ) {}

  /** Writes MAP_PX² RGBA pixels centred on the tile. Returns false while blocks are missing. */
  compose(centerTx: number, centerTy: number, out: Uint8ClampedArray): boolean {
    const mx0 = Math.floor(centerTx / TILES_PER_MAP_PX) - MAP_PX / 2;
    const my0 = Math.floor(centerTy / TILES_PER_MAP_PX) - MAP_PX / 2;
    let budget = BLOCKS_PER_COMPOSE;
    let complete = true;

    // Visit blocks nearest the centre first, so the area around Gizmo fills in first.
    // Distances are measured from the centre of Gizmo's map pixel to block centres.
    const cbx = (mx0 + MAP_PX / 2 + 0.5) / BLOCK_PX - 0.5;
    const cby = (my0 + MAP_PX / 2 + 0.5) / BLOCK_PX - 0.5;
    const order: Array<[number, number]> = [];
    for (
      let by = Math.floor(my0 / BLOCK_PX);
      by <= Math.floor((my0 + MAP_PX - 1) / BLOCK_PX);
      by++
    ) {
      for (
        let bx = Math.floor(mx0 / BLOCK_PX);
        bx <= Math.floor((mx0 + MAP_PX - 1) / BLOCK_PX);
        bx++
      ) {
        order.push([bx, by]);
      }
    }
    order.sort(
      ([ax, ay], [bx, by]) =>
        (ax - cbx) ** 2 + (ay - cby) ** 2 - ((bx - cbx) ** 2 + (by - cby) ** 2),
    );

    for (const [bx, by] of order) {
      const key = `${bx},${by}`;
      let block = this.blocks.get(key);
      if (!block && budget > 0) {
        budget--;
        block = this.buildBlock(bx, by);
        this.blocks.set(key, block);
      }
      if (!block) complete = false;

      // Paint the part of this block that falls inside the view.
      const x0 = Math.max(bx * BLOCK_PX, mx0);
      const x1 = Math.min((bx + 1) * BLOCK_PX, mx0 + MAP_PX);
      const y0 = Math.max(by * BLOCK_PX, my0);
      const y1 = Math.min((by + 1) * BLOCK_PX, my0 + MAP_PX);
      for (let my = y0; my < y1; my++) {
        for (let mx = x0; mx < x1; mx++) {
          const c =
            block && this.explored.isTileRevealed(mx * TILES_PER_MAP_PX, my * TILES_PER_MAP_PX)
              ? TERRAIN_RGB[block[(my - by * BLOCK_PX) * BLOCK_PX + (mx - bx * BLOCK_PX)]]
              : FOG_RGB;
          const o = ((my - my0) * MAP_PX + (mx - mx0)) * 4;
          out[o] = c[0];
          out[o + 1] = c[1];
          out[o + 2] = c[2];
          out[o + 3] = 255;
        }
      }
    }
    return complete;
  }

  private buildBlock(bx: number, by: number): Uint8Array {
    const block = new Uint8Array(BLOCK_PX * BLOCK_PX);
    for (let y = 0; y < BLOCK_PX; y++) {
      for (let x = 0; x < BLOCK_PX; x++) {
        block[y * BLOCK_PX + x] = this.sample(
          (bx * BLOCK_PX + x) * TILES_PER_MAP_PX,
          (by * BLOCK_PX + y) * TILES_PER_MAP_PX,
        );
      }
    }
    return block;
  }
}

const PREF_KEY = 'gizmo.minimap';
const REDRAW_MS = 100;

function readVisiblePref(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== 'hidden';
  } catch {
    return true;
  }
}

function writeVisiblePref(visible: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, visible ? 'shown' : 'hidden');
  } catch {
    // Preference only; ignore unavailable storage.
  }
}

/** The minimap panel: toggles, and redraws only when Gizmo moves or new areas are revealed. */
export class Minimap {
  visible: boolean;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly image: ImageData;
  private model: MinimapModel | null = null;
  private source: { world: World; explored: ExploredMap } | null = null;
  private last = { mx: NaN, my: NaN, revision: -1, complete: false, at: -Infinity };

  constructor(
    canvas: HTMLCanvasElement,
    private readonly panel: HTMLElement,
    button: HTMLElement,
  ) {
    canvas.width = MAP_PX;
    canvas.height = MAP_PX;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
    this.image = ctx.createImageData(MAP_PX, MAP_PX);
    this.visible = readVisiblePref();
    panel.hidden = !this.visible;
    button.addEventListener('click', () => this.toggle());
  }

  toggle(): void {
    this.visible = !this.visible;
    this.panel.hidden = !this.visible;
    writeVisiblePref(this.visible);
    this.last.at = -Infinity;
    this.last.revision = -1;
  }

  update(world: World, explored: ExploredMap, tx: number, ty: number, now: number): void {
    if (!this.visible) return;
    if (this.source?.world !== world || this.source.explored !== explored) {
      this.source = { world, explored };
      this.model = new MinimapModel((x, y) => world.generator.sampleTile(x, y).terrain, explored);
      this.last = { mx: NaN, my: NaN, revision: -1, complete: false, at: -Infinity };
    }
    const mx = Math.floor(tx / TILES_PER_MAP_PX);
    const my = Math.floor(ty / TILES_PER_MAP_PX);
    const dirty =
      mx !== this.last.mx ||
      my !== this.last.my ||
      explored.revision !== this.last.revision ||
      !this.last.complete;
    // While blocks are still being built, redraw every frame so the map fills in quickly.
    const throttled = this.last.complete && now - this.last.at < REDRAW_MS;
    if (!dirty || throttled || !this.model) return;

    const complete = this.model.compose(tx, ty, this.image.data);
    this.ctx.putImageData(this.image, 0, 0);
    const c = MAP_PX / 2;
    this.ctx.fillStyle = '#1d2b2a';
    this.ctx.fillRect(c - 2, c - 2, 5, 5);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(c - 1, c - 1, 3, 3);
    this.last = { mx, my, revision: explored.revision, complete, at: now };
  }
}
