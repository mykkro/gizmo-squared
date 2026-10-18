import { CHUNK_PX, PREFETCH_GENERATIONS_PER_FRAME, TILE_PX } from '../config';
import { BIOMES } from '../data/biomes';
import { ITEMS, NO_ITEM } from '../data/items';
import type { Player } from '../entities/Player';
import { isTired } from '../systems/energy';
import type { World } from '../world/World';
import { BakeCache } from './BakeCache';
import { computeZoom, type Camera } from './camera';
import { bakeChunk, type CanvasLike } from './chunkBaker';
import { GIZMO_FEET_ROW, GIZMO_FRAMES, GIZMO_TIRED, ITEM_SPRITES, spriteToCanvas } from './sprites';

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
  time: number;
  debugTint: boolean;
}

const BACKGROUND = '#1b1f24';
const UNBAKED = '#2a3b2f';

export class Renderer {
  zoom = 2;
  private readonly ctx: CanvasRenderingContext2D;
  private world: World | null = null;
  private bakes: BakeCache | null = null;
  private readonly gizmo = GIZMO_FRAMES.map(spriteToCanvas);
  private readonly gizmoTired = spriteToCanvas(GIZMO_TIRED);
  private readonly itemCanvases = new Map<number, CanvasLike>(
    ITEMS.map((it) => [it.id, spriteToCanvas(ITEM_SPRITES[it.key])]),
  );

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
  }

  setWorld(world: World): void {
    this.world = world;
    this.bakes = new BakeCache((chunk) => bakeChunk(chunk, world.seed));
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

  render(s: RenderState): void {
    const { ctx, canvas, zoom: z, world, bakes } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!world || !bakes) return;
    bakes.beginFrame();

    // Snap the camera to whole texture pixels so nothing shimmers.
    const camX = Math.round(s.camera.x);
    const camY = Math.round(s.camera.y);
    ctx.setTransform(
      z,
      0,
      0,
      z,
      Math.floor(canvas.width / 2) - camX * z,
      Math.floor(canvas.height / 2) - camY * z,
    );
    ctx.imageSmoothingEnabled = false;

    const halfW = canvas.width / 2 / z;
    const halfH = canvas.height / 2 / z;
    const left = camX - halfW;
    const top = camY - halfH;
    const right = camX + halfW;
    const bottom = camY + halfH;

    // Visible chunks.
    const cx0 = Math.floor(left / CHUNK_PX);
    const cx1 = Math.floor(right / CHUNK_PX);
    const cy0 = Math.floor(top / CHUNK_PX);
    const cy1 = Math.floor(bottom / CHUNK_PX);
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const img = bakes.get(world.getChunk(cx, cy));
        if (img) {
          ctx.drawImage(img, cx * CHUNK_PX, cy * CHUNK_PX);
        } else {
          ctx.fillStyle = UNBAKED;
          ctx.fillRect(cx * CHUNK_PX, cy * CHUNK_PX, CHUNK_PX, CHUNK_PX);
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

    // Items (bobbing 1 px, phase-shifted per tile).
    const tx0 = Math.floor(left / TILE_PX);
    const tx1 = Math.floor(right / TILE_PX);
    const ty0 = Math.floor(top / TILE_PX);
    const ty1 = Math.floor(bottom / TILE_PX);
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const id = world.itemAt(tx, ty);
        if (id === NO_ITEM) continue;
        const img = this.itemCanvases.get(id);
        if (!img) continue;
        const bob = Math.round(Math.sin(s.time * 3 * Math.PI + tx * 7 + ty * 13));
        ctx.drawImage(img, tx * TILE_PX + 4, ty * TILE_PX + 4 + bob);
      }
    }

    if (s.debugTint) {
      ctx.globalAlpha = 0.35;
      for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          ctx.fillStyle = BIOMES[world.biomeAt(tx, ty)].tint;
          ctx.fillRect(tx * TILE_PX, ty * TILE_PX, TILE_PX, TILE_PX);
        }
      }
      ctx.globalAlpha = 1;
    }

    // Magnet flyers.
    const p = s.player;
    for (const f of s.flyers) {
      const img = this.itemCanvases.get(f.itemId);
      if (!img) continue;
      const e = f.t * f.t;
      const x = f.fromX + (p.x - f.fromX) * e;
      const y = f.fromY + (p.y - 8 - f.fromY) * e;
      ctx.drawImage(img, Math.round(x - 4), Math.round(y - 4));
    }

    // Gizmo: feet row sits on p.y.
    const frame = isTired(p)
      ? this.gizmoTired
      : this.gizmo[p.moving ? Math.floor(p.animTime * 6) % this.gizmo.length : 0];
    const gx = Math.round(p.x) - 8;
    const gy = Math.round(p.y) - (GIZMO_FEET_ROW + 1);
    if (p.facing === -1) {
      ctx.save();
      ctx.translate(gx + 16, gy);
      ctx.scale(-1, 1);
      ctx.drawImage(frame, 0, 0);
      ctx.restore();
    } else {
      ctx.drawImage(frame, gx, gy);
    }
  }
}
