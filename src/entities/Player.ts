import { MAX_ENERGY, TILE_PX } from '../config';
import type { EffectKind } from '../data/items';

export const HITBOX_HALF_W = 5;
export const HITBOX_H = 8;

export interface ActiveEffect {
  kind: EffectKind;
  /** Seconds left. */
  remaining: number;
}

export class Player {
  /** Centre of the feet, in world pixels. The hitbox spans x±5, y-8..y. */
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  facing: 1 | -1 = 1;
  moving = false;
  energy = MAX_ENERGY;
  treasures = 0;
  effects: ActiveEffect[] = [];
  animTime = 0;
  /** Position at the previous tick, for render interpolation. */
  prevX = 0;
  prevY = 0;

  /** Moves instantly (no interpolation from the old position). */
  setPosition(x: number, y: number): void {
    this.x = this.prevX = x;
    this.y = this.prevY = y;
    this.vx = 0;
    this.vy = 0;
  }

  /** Puts the hitbox fully inside the given tile. */
  placeAtTile(tx: number, ty: number): void {
    this.setPosition(tx * TILE_PX + TILE_PX / 2, ty * TILE_PX + TILE_PX - 4);
  }

  tileX(): number {
    return Math.floor(this.x / TILE_PX);
  }

  /** Tile under the middle of the hitbox. */
  tileY(): number {
    return Math.floor((this.y - HITBOX_H / 2) / TILE_PX);
  }
}
