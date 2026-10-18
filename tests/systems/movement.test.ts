import { describe, expect, it } from 'vitest';
import { BASE_SPEED, TICK_DT } from '../../src/config';
import { hash2, mulberry32 } from '../../src/core/rng';
import type { Vec2 } from '../../src/core/vec';
import { TERRAINS, TERRAIN_INDEX, type TerrainDef } from '../../src/data/terrains';
import { Player } from '../../src/entities/Player';
import { World } from '../../src/world/World';
import { addEffect } from '../../src/systems/effects';
import {
  hitboxHitsSolid,
  moveAxis,
  unstick,
  updateMovement,
  type MovementEnv,
  type SolidFn,
} from '../../src/systems/movement';

const GRASS = TERRAINS[TERRAIN_INDEX.grass];
const MUD = TERRAINS[TERRAIN_INDEX.mud];
const ICE = TERRAINS[TERRAIN_INDEX.ice];
const RIGHT: Vec2 = { x: 1, y: 0 };
const STOP: Vec2 = { x: 0, y: 0 };

function solidSet(tiles: Array<[number, number]>): SolidFn {
  const s = new Set(tiles.map(([x, y]) => `${x},${y}`));
  return (tx, ty) => s.has(`${tx},${ty}`);
}

function env(isSolid: SolidFn = () => false, terrain: TerrainDef = GRASS): MovementEnv {
  return { isSolid, terrainAt: () => terrain };
}

function run(p: Player, input: Vec2, seconds: number, e: MovementEnv): void {
  for (let i = 0; i < Math.round(seconds / TICK_DT); i++) updateMovement(p, input, TICK_DT, e);
}

function distanceRight(setup: (p: Player) => void, e: MovementEnv = env()): number {
  const p = new Player();
  p.placeAtTile(0, 0);
  setup(p);
  const x0 = p.x;
  run(p, RIGHT, 1, e);
  return p.x - x0;
}

describe('movement', () => {
  it('moves at about base speed in the open', () => {
    const d = distanceRight(() => {});
    expect(d).toBeGreaterThan(BASE_SPEED * 0.9);
    expect(d).toBeLessThanOrEqual(BASE_SPEED);
  });

  it('stops flush against a wall', () => {
    const wall = solidSet(Array.from({ length: 11 }, (_, i) => [3, i - 5] as [number, number]));
    const p = new Player();
    p.placeAtTile(0, 0);
    run(p, RIGHT, 2, env(wall));
    expect(p.x + 5).toBeLessThanOrEqual(48);
    expect(p.x + 5).toBeGreaterThan(46);
  });

  it('slides along a wall when moving diagonally', () => {
    const wall = solidSet(Array.from({ length: 20 }, (_, i) => [1, i - 5] as [number, number]));
    const p = new Player();
    p.placeAtTile(0, 0);
    const y0 = p.y;
    run(p, { x: Math.SQRT1_2, y: Math.SQRT1_2 }, 1, env(wall));
    expect(p.y - y0).toBeGreaterThan(40);
    expect(p.x + 5).toBeLessThanOrEqual(16);
  });

  it('does not tunnel through a one-tile wall with a huge step', () => {
    const p = new Player();
    p.placeAtTile(0, 0);
    moveAxis(p, 'x', 40, solidSet([[1, 0]]));
    expect(p.x + 5).toBeLessThanOrEqual(16);
  });

  it('never ends inside a solid tile under random input', () => {
    const isSolid: SolidFn = (tx, ty) =>
      Math.max(Math.abs(tx), Math.abs(ty)) > 1 && hash2(5, tx, ty) < 0.25;
    const p = new Player();
    p.placeAtTile(0, 0);
    addEffect(p.effects, 'zoom', 1000);
    const r = mulberry32(3);
    let dir: Vec2 = STOP;
    let violations = 0;
    for (let i = 0; i < 3000; i++) {
      if (i % 20 === 0) {
        const a = r() * Math.PI * 2;
        dir = { x: Math.cos(a), y: Math.sin(a) };
      }
      updateMovement(p, dir, TICK_DT, env(isSolid));
      if (hitboxHitsSolid(p.x, p.y, isSolid)) violations++;
    }
    expect(violations).toBe(0);
  });

  it('is slower on mud', () => {
    expect(distanceRight(() => {}, env(undefined, MUD))).toBeLessThan(
      distanceRight(() => {}) * 0.75,
    );
  });

  it('halves speed when tired', () => {
    const ratio = distanceRight((p) => (p.energy = 0)) / distanceRight(() => {});
    expect(ratio).toBeGreaterThan(0.45);
    expect(ratio).toBeLessThan(0.55);
  });

  it('is faster with the zoom effect', () => {
    expect(distanceRight((p) => addEffect(p.effects, 'zoom', 10))).toBeGreaterThan(
      distanceRight(() => {}) * 1.6,
    );
  });

  it('keeps momentum on ice after input stops', () => {
    const coast = (terrain: TerrainDef) => {
      const p = new Player();
      p.placeAtTile(0, 0);
      run(p, RIGHT, 1, env(undefined, terrain));
      const x0 = p.x;
      run(p, STOP, 0.5, env(undefined, terrain));
      return p.x - x0;
    };
    expect(coast(ICE)).toBeGreaterThan(coast(GRASS) * 3);
  });

  it('wobble bends a straight path', () => {
    const p = new Player();
    p.placeAtTile(0, 0);
    addEffect(p.effects, 'wobble', 1.5);
    const y0 = p.y;
    let maxDev = 0;
    for (let i = 0; i < 30; i++) {
      updateMovement(p, RIGHT, TICK_DT, env());
      maxDev = Math.max(maxDev, Math.abs(p.y - y0));
    }
    expect(maxDev).toBeGreaterThan(1);
  });

  it('marks moving and facing from input', () => {
    const p = new Player();
    updateMovement(p, { x: -1, y: 0 }, TICK_DT, env());
    expect(p.moving).toBe(true);
    expect(p.facing).toBe(-1);
    updateMovement(p, STOP, TICK_DT, env());
    expect(p.moving).toBe(false);
  });
});

describe('unstick', () => {
  it('moves a player out of a solid tile', () => {
    const p = new Player();
    p.placeAtTile(0, 0);
    const moved = unstick(p, {
      isSolid: solidSet([[0, 0]]),
      findWalkableNear: () => ({ tx: 5, ty: 5 }),
    });
    expect(moved).toBe(true);
    expect([p.tileX(), p.tileY()]).toEqual([5, 5]);
  });

  it('works with a real World instance (methods called with the right this)', () => {
    const world = new World('unstick-test');
    let solid: [number, number] | null = null;
    for (let ty = 0; ty < 64 && !solid; ty++) {
      for (let tx = 0; tx < 64 && !solid; tx++) if (world.isSolid(tx, ty)) solid = [tx, ty];
    }
    if (!solid) throw new Error('no solid tile in test area');
    const p = new Player();
    p.placeAtTile(solid[0], solid[1]);
    expect(unstick(p, world)).toBe(true);
    expect(hitboxHitsSolid(p.x, p.y, (tx, ty) => world.isSolid(tx, ty))).toBe(false);
  });

  it('asks for a destination with room to walk away (not a sealed pocket)', () => {
    const p = new Player();
    p.placeAtTile(0, 0);
    let minReach = 0;
    unstick(p, {
      isSolid: solidSet([[0, 0]]),
      findWalkableNear: (_tx, _ty, _r, reach = 1) => {
        minReach = reach;
        return { tx: 3, ty: 3 };
      },
    });
    expect(minReach).toBeGreaterThanOrEqual(256);
  });

  it('leaves a free player alone', () => {
    const p = new Player();
    p.placeAtTile(2, 2);
    const before = [p.x, p.y];
    expect(unstick(p, { isSolid: () => false, findWalkableNear: () => null })).toBe(false);
    expect([p.x, p.y]).toEqual(before);
  });
});
