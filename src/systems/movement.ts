import { BASE_SPEED, TILE_PX, TIRED_SPEED_MULT } from '../config';
import type { Vec2 } from '../core/vec';
import type { TerrainDef } from '../data/terrains';
import { HITBOX_H, HITBOX_HALF_W, type Player } from '../entities/Player';
import type { TileCoord } from '../world/World';
import { effectSpeedMultiplier, hasEffect } from './effects';
import { isTired } from './energy';

export type SolidFn = (tx: number, ty: number) => boolean;

export interface MovementEnv {
  isSolid: SolidFn;
  terrainAt: (tx: number, ty: number) => TerrainDef;
}

/** Velocity response per second on normal ground and on slippery ground. */
const ACCEL = 20;
const ICE_ACCEL = 3;
const WOBBLE_FREQ = 12;
const WOBBLE_ANGLE = 0.6;
const EPS = 1e-6;

export function hitboxHitsSolid(x: number, y: number, isSolid: SolidFn): boolean {
  const x0 = Math.floor((x - HITBOX_HALF_W) / TILE_PX);
  const x1 = Math.floor((x + HITBOX_HALF_W - EPS) / TILE_PX);
  const y0 = Math.floor((y - HITBOX_H) / TILE_PX);
  const y1 = Math.floor((y - EPS) / TILE_PX);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (isSolid(tx, ty)) return true;
    }
  }
  return false;
}

/** Moves along one axis in steps of at most 1 px, stopping at the first collision. */
export function moveAxis(p: Player, axis: 'x' | 'y', delta: number, isSolid: SolidFn): void {
  if (delta === 0) return;
  const steps = Math.ceil(Math.abs(delta));
  const step = delta / steps;
  for (let i = 0; i < steps; i++) {
    const nx = axis === 'x' ? p.x + step : p.x;
    const ny = axis === 'y' ? p.y + step : p.y;
    if (hitboxHitsSolid(nx, ny, isSolid)) {
      if (axis === 'x') p.vx = 0;
      else p.vy = 0;
      return;
    }
    p.x = nx;
    p.y = ny;
  }
}

function wobble(dir: Vec2, time: number): Vec2 {
  const a = Math.sin(time * WOBBLE_FREQ) * WOBBLE_ANGLE;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return { x: dir.x * cos - dir.y * sin, y: dir.x * sin + dir.y * cos };
}

export function updateMovement(p: Player, input: Vec2, dt: number, env: MovementEnv): void {
  p.prevX = p.x;
  p.prevY = p.y;
  const terrain = env.terrainAt(p.tileX(), p.tileY());
  const hasInput = input.x !== 0 || input.y !== 0;
  const dir = hasInput && hasEffect(p.effects, 'wobble') ? wobble(input, p.animTime) : input;
  const speed =
    BASE_SPEED *
    terrain.speed *
    effectSpeedMultiplier(p.effects) *
    (isTired(p) ? TIRED_SPEED_MULT : 1);
  const k = Math.min(1, (terrain.slippery ? ICE_ACCEL : ACCEL) * dt);

  p.vx += (dir.x * speed - p.vx) * k;
  p.vy += (dir.y * speed - p.vy) * k;
  if (!hasInput && Math.hypot(p.vx, p.vy) < 0.5) {
    p.vx = 0;
    p.vy = 0;
  }

  moveAxis(p, 'x', p.vx * dt, env.isSolid);
  moveAxis(p, 'y', p.vy * dt, env.isSolid);

  p.moving = hasInput;
  if (input.x !== 0) p.facing = input.x > 0 ? 1 : -1;
  p.animTime += dt;
}

export interface UnstickWorld {
  isSolid: SolidFn;
  findWalkableNear(tx: number, ty: number, maxRadius: number, minReach?: number): TileCoord | null;
}

/** A rescue tile must open onto at least this many walkable tiles (no sealed pockets). */
const UNSTICK_MIN_REACH = 256;

/** If the player overlaps a solid tile (e.g. after loading an old save), move them out. */
export function unstick(p: Player, world: UnstickWorld): boolean {
  // Wrap the method: passing world.isSolid directly would lose `this` for class instances.
  if (!hitboxHitsSolid(p.x, p.y, (tx, ty) => world.isSolid(tx, ty))) return false;
  const t =
    world.findWalkableNear(p.tileX(), p.tileY(), 64, UNSTICK_MIN_REACH) ??
    world.findWalkableNear(p.tileX(), p.tileY(), 64);
  if (t) p.placeAtTile(t.tx, t.ty);
  return true;
}
