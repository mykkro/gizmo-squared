import { describe, expect, it } from 'vitest';
import { MAX_TICKS_PER_FRAME, TICK_DT } from '../../src/config';
import { stepAccumulator } from '../../src/core/loop';
import type { Vec2 } from '../../src/core/vec';
import { TERRAINS, TERRAIN_INDEX } from '../../src/data/terrains';
import { Player } from '../../src/entities/Player';
import { Camera, interpolate, screenOrigin, toScreen } from '../../src/render/camera';
import { updateMovement } from '../../src/systems/movement';

const env = { isSolid: () => false, terrainAt: () => TERRAINS[TERRAIN_INDEX.grass] };
const SCREEN = 1280;
const ZOOM = 2.5;

/**
 * Runs the real loop → movement → camera → screen-pixel pipeline frame by frame and records
 * how far the world (screen origin) and Gizmo move on screen each rendered frame.
 */
function simulate(hz: number, dir: Vec2) {
  const p = new Player();
  p.placeAtTile(0, 0);
  const cam = new Camera();
  cam.snap(p.x, p.y);
  let acc = 0;
  const world: number[] = [];
  const gizmo: number[] = [];
  let prev: [number, number, number, number] | null = null;
  for (let f = 0; f < 300; f++) {
    const r = stepAccumulator(acc, 1 / hz, TICK_DT, MAX_TICKS_PER_FRAME);
    acc = r.accumulator;
    for (let i = 0; i < r.ticks; i++) {
      updateMovement(p, dir, TICK_DT, env);
      cam.follow(p.x, p.y, TICK_DT);
    }
    const alpha = acc / TICK_DT;
    const cx = interpolate(cam.prevX, cam.x, alpha);
    const cy = interpolate(cam.prevY, cam.y, alpha);
    const ox = screenOrigin(cx, ZOOM, SCREEN);
    const oy = screenOrigin(cy, ZOOM, SCREEN);
    const gx = toScreen(interpolate(p.prevX, p.x, alpha), cx, ZOOM, SCREEN);
    const gy = toScreen(interpolate(p.prevY, p.y, alpha), cy, ZOOM, SCREEN);
    if (prev && f > 150) {
      world.push(ox - prev[0], oy - prev[1]);
      gizmo.push(gx - prev[2], gy - prev[3]);
    }
    prev = [ox, oy, gx, gy];
  }
  return { world, gizmo };
}

/** Largest difference between consecutive per-frame steps (0 = perfectly even motion). */
function unevenness(steps: number[]): number {
  let worst = 0;
  for (let i = 2; i < steps.length; i += 1)
    worst = Math.max(worst, Math.abs(steps[i] - steps[i - 2]));
  return worst;
}

describe('render smoothness', () => {
  const straight = { x: 1, y: 0 };
  const diagonal = { x: Math.SQRT1_2, y: Math.SQRT1_2 };
  it.each([
    [60, straight],
    [144, straight],
    [75, straight],
    [60, diagonal],
    [144, diagonal],
  ])('%i Hz %o: world and Gizmo move evenly (±1 device px)', (hz, dir) => {
    const { world, gizmo } = simulate(hz, dir);
    expect(unevenness(world)).toBeLessThanOrEqual(1);
    expect(unevenness(gizmo)).toBeLessThanOrEqual(1);
  });
});
