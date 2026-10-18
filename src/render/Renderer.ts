import { CHUNK_PX, PREFETCH_GENERATIONS_PER_FRAME, TILE_PX } from '../config';
import { BIOMES } from '../data/biomes';
import { ITEMS, NO_ITEM } from '../data/items';
import { HITBOX_H, type Player } from '../entities/Player';
import { isTired } from '../systems/energy';
import { CELL_TILES, type ExploredMap } from '../world/explored';
import type { World } from '../world/World';
import { BakeCache } from './BakeCache';
import {
  chunkRect,
  computeZoom,
  interpolate,
  originOf,
  spanRect,
  toScreen,
  type Camera,
} from './camera';
import { bakeChunk } from './chunkBaker';
import { fogMask } from './fog';
import { SpriteCache } from './spriteCache';
import { GIZMO_DEFS, GIZMO_FEET_ROW, ITEM_DEFS, rasterize, type SpriteDef } from './sprites';

/** An item flying towards Gizmo after a magnet pickup. t goes 0 → 1. */
export interface Flyer {
  itemId: number;
  fromX: number;
  fromY: number;
  t: number;
}

export interface RenderState {
  player: Player;
  camera: Camera;
  flyers: readonly Flyer[];
  explored: ExploredMap;
  time: number;
  debugTint: boolean;
  /** Fraction of a tick elapsed since the last update (0..1), for interpolation. */
  alpha: number;
}

const BACKGROUND = '#14181c';
const UNBAKED = '#2a3b2f';
const FOG_RGB = [20, 24, 28];
const CELL_PX = CELL_TILES * TILE_PX;

export class Renderer {
  zoom = 2;
  /** Duration of the most recent chunk bake (ms), for the debug overlay. */
  lastBakeMs = 0;
  private readonly ctx: CanvasRenderingContext2D;
  private world: World | null = null;
  private bakes: BakeCache | null = null;
  private readonly sprites = new SpriteCache<SpriteDef, HTMLCanvasElement>(Renderer.toCanvas);
  private readonly fogCanvas = document.createElement('canvas');

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
  }

  setWorld(world: World): void {
    this.world = world;
    const terrainAt = (tx: number, ty: number) => world.generator.sampleTile(tx, ty).terrain;
    this.bakes = new BakeCache((chunk) => {
      const t0 = performance.now();
      const img = bakeChunk(chunk, terrainAt);
      this.lastBakeMs = performance.now() - t0;
      return img;
    });
  }

  resize(cssW: number, cssH: number, dpr: number): void {
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.zoom = computeZoom(Math.min(this.canvas.width, this.canvas.height));
  }

  stats(): { bakedCanvases: number; bakesThisFrame: number } {
    return {
      bakedCanvases: this.bakes?.size ?? 0,
      bakesThisFrame: this.bakes?.bakesThisFrame ?? 0,
    };
  }

  /** Rasterises a sprite definition into a canvas (used by the sprite cache). */
  private static toCanvas(def: SpriteDef, scale: number): HTMLCanvasElement {
    const img = rasterize(def, scale);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    const data = ctx.createImageData(img.width, img.height);
    data.data.set(img.data);
    ctx.putImageData(data, 0, 0);
    return canvas;
  }

  render(s: RenderState): void {
    const { ctx, canvas, zoom: z, world, bakes } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!world || !bakes) return;
    bakes.beginFrame();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const camX = interpolate(s.camera.prevX, s.camera.x, s.alpha);
    const camY = interpolate(s.camera.prevY, s.camera.y, s.alpha);
    const ox = originOf(camX, z, canvas.width);
    const oy = originOf(camY, z, canvas.height);
    const left = -ox / z;
    const top = -oy / z;
    const right = (canvas.width - ox) / z;
    const bottom = (canvas.height - oy) / z;

    // Terrain chunks, each in a whole-pixel rectangle so neighbours meet exactly.
    const cx0 = Math.floor(left / CHUNK_PX);
    const cx1 = Math.floor(right / CHUNK_PX);
    const cy0 = Math.floor(top / CHUNK_PX);
    const cy1 = Math.floor(bottom / CHUNK_PX);
    for (let cy = cy0; cy <= cy1; cy++) {
      const [y, h] = chunkRect(cy, CHUNK_PX, z, oy);
      for (let cx = cx0; cx <= cx1; cx++) {
        const [x, w] = chunkRect(cx, CHUNK_PX, z, ox);
        const img = bakes.get(world.getChunk(cx, cy));
        if (img) {
          ctx.drawImage(img, x, y, w, h);
        } else {
          ctx.fillStyle = UNBAKED;
          ctx.fillRect(x, y, w, h);
        }
      }
    }

    // Prefetch one ring beyond the viewport, within the generation and bake budgets.
    let generations = PREFETCH_GENERATIONS_PER_FRAME;
    for (let cy = cy0 - 1; cy <= cy1 + 1; cy++) {
      for (let cx = cx0 - 1; cx <= cx1 + 1; cx++) {
        if (cx >= cx0 && cx <= cx1 && cy >= cy0 && cy <= cy1) continue;
        if (!world.hasChunk(cx, cy)) {
          if (generations <= 0) continue;
          generations--;
        }
        bakes.get(world.getChunk(cx, cy));
      }
    }

    const tx0 = Math.floor(left / TILE_PX);
    const tx1 = Math.floor(right / TILE_PX);
    const ty0 = Math.floor(top / TILE_PX);
    const ty1 = Math.floor(bottom / TILE_PX);

    if (s.debugTint) {
      ctx.setTransform(z, 0, 0, z, ox, oy);
      ctx.globalAlpha = 0.35;
      for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          ctx.fillStyle = BIOMES[world.biomeAt(tx, ty)].tint;
          ctx.fillRect(tx * TILE_PX, ty * TILE_PX, TILE_PX, TILE_PX);
        }
      }
      ctx.globalAlpha = 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    // Sprites are pre-rasterised near the zoom (see SpriteCache) and drawn at def size x zoom,
    // placed at whole device pixels.
    this.sprites.beginFrame();
    const draw = (def: SpriteDef, worldX: number, worldY: number, flip = false) => {
      const img = this.sprites.get(def, z);
      const sx = toScreen(worldX, camX, z, canvas.width);
      const sy = toScreen(worldY, camY, z, canvas.height);
      const w = def.w * z;
      const h = def.h * z;
      if (flip) {
        ctx.setTransform(-1, 0, 0, 1, sx + w, sy);
        ctx.drawImage(img, 0, 0, w, h);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      } else {
        ctx.drawImage(img, sx, sy, w, h);
      }
    };

    // Items, gently bobbing (phase-shifted per tile).
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const id = world.itemAt(tx, ty);
        if (id === NO_ITEM) continue;
        const def = ITEM_DEFS[ITEMS[id - 1].key];
        const inset = (TILE_PX - def.w) / 2;
        const bob = Math.sin(s.time * 3 * Math.PI + tx * 7 + ty * 13);
        draw(def, tx * TILE_PX + inset, ty * TILE_PX + inset + bob);
      }
    }

    // Magnet flyers.
    const p = s.player;
    const px = interpolate(p.prevX, p.x, s.alpha);
    const py = interpolate(p.prevY, p.y, s.alpha);
    for (const f of s.flyers) {
      const def = ITEM_DEFS[ITEMS[f.itemId - 1].key];
      const e = f.t * f.t;
      const x = f.fromX + (px - f.fromX) * e;
      const y = f.fromY + (py - HITBOX_H - f.fromY) * e;
      draw(def, x - def.w / 2, y - def.h / 2);
    }

    this.drawFog(s.explored, ox, oy, left, top, right, bottom);

    // Gizmo: the feet row sits on the player's y.
    const def = isTired(p)
      ? GIZMO_DEFS.tired
      : GIZMO_DEFS.walk[p.moving ? Math.floor(p.animTime * 6) % GIZMO_DEFS.walk.length : 0];
    draw(def, px - def.w / 2, py - (GIZMO_FEET_ROW + 1), p.facing === -1);
  }

  /** Soft fog of war: one mask texel per fog cell, stretched with smoothing. */
  private drawFog(
    explored: ExploredMap,
    ox: number,
    oy: number,
    left: number,
    top: number,
    right: number,
    bottom: number,
  ): void {
    const c0x = Math.floor(left / CELL_PX) - 1;
    const c0y = Math.floor(top / CELL_PX) - 1;
    const w = Math.floor(right / CELL_PX) + 2 - c0x;
    const h = Math.floor(bottom / CELL_PX) + 2 - c0y;
    const mask = fogMask(explored, c0x, c0y, w, h);
    if (!mask.some((a) => a > 0)) return;

    const fc = this.fogCanvas;
    if (fc.width !== w || fc.height !== h) {
      fc.width = w;
      fc.height = h;
    }
    const fctx = fc.getContext('2d');
    if (!fctx) return;
    const img = fctx.createImageData(w, h);
    for (let i = 0; i < mask.length; i++) {
      img.data[i * 4] = FOG_RGB[0];
      img.data[i * 4 + 1] = FOG_RGB[1];
      img.data[i * 4 + 2] = FOG_RGB[2];
      img.data[i * 4 + 3] = mask[i];
    }
    fctx.putImageData(img, 0, 0);
    // Round the ends of the whole fog span once, so the layer never stretches while walking.
    const [x, fw] = spanRect(c0x * CELL_PX, (c0x + w) * CELL_PX, this.zoom, ox);
    const [y, fh] = spanRect(c0y * CELL_PX, (c0y + h) * CELL_PX, this.zoom, oy);
    this.ctx.drawImage(fc, x, y, fw, fh);
  }
}
