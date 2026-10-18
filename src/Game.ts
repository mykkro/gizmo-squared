import { MAX_ENERGY, TILE_PX } from './config';
import { BIOMES } from './data/biomes';
import { TERRAINS } from './data/terrains';
import { Player } from './entities/Player';
import type { Input } from './input/Input';
import { Camera } from './render/camera';
import type { Flyer, Renderer } from './render/Renderer';
import type { SaveData } from './save/storage';
import { createDiscoveryState, updateDiscovery, type DiscoveryState } from './systems/discovery';
import { tickEffects } from './systems/effects';
import { tickEnergy } from './systems/energy';
import { unstick, updateMovement, type MovementEnv } from './systems/movement';
import { collectItems } from './systems/pickups';
import type { Hud } from './ui/hud';
import { ExploredMap } from './world/explored';
import { World } from './world/World';

/** Camera looks slightly above the feet so Gizmo appears centred. */
const CAMERA_OFFSET_Y = (TILE_PX * 3) / 8;
const FLYER_SECONDS = 0.3;

export class Game {
  world!: World;
  player = new Player();
  readonly camera = new Camera();
  discovery: DiscoveryState = createDiscoveryState();
  flyers: Flyer[] = [];
  time = 0;
  debugTint = false;
  /** Fog of war: areas Gizmo has seen. */
  explored = new ExploredMap();
  private env!: MovementEnv;
  private revealedAt = { tx: NaN, ty: NaN };

  constructor(
    private readonly renderer: Renderer,
    private readonly hud: Hud,
    private readonly input: Input,
  ) {}

  newWorld(seedText: string): void {
    this.world = new World(seedText);
    this.player = new Player();
    const spawn = this.world.findSpawn();
    this.player.placeAtTile(spawn.tx, spawn.ty);
    this.discovery = createDiscoveryState();
    this.explored = new ExploredMap();
    this.afterWorldChange();
  }

  load(data: SaveData): void {
    this.world = new World(data.seed, data.chunkDiffs);
    const p = new Player();
    p.setPosition(data.player.x, data.player.y);
    p.energy = Math.min(MAX_ENERGY, Math.max(0, data.player.energy));
    p.treasures = Math.max(0, Math.floor(data.player.treasures));
    p.effects = data.player.effects.map((e) => ({ ...e }));
    this.player = p;
    unstick(p, this.world);
    this.discovery = createDiscoveryState(data.discoveredBiomes);
    this.explored = ExploredMap.deserialize(data.explored);
    this.afterWorldChange();
  }

  private afterWorldChange(): void {
    const world = this.world;
    this.env = {
      isSolid: (tx, ty) => world.isSolid(tx, ty),
      terrainAt: (tx, ty) => TERRAINS[world.terrainAt(tx, ty)],
    };
    this.flyers = [];
    this.renderer.setWorld(world);
    this.camera.snap(this.player.x, this.player.y - CAMERA_OFFSET_Y);
    this.explored.reveal(this.player.tileX(), this.player.tileY());
  }

  update(dt: number): void {
    const p = this.player;
    updateMovement(p, this.input.direction(), dt, this.env);
    tickEffects(p.effects, dt);

    const tx = p.tileX();
    const ty = p.tileY();
    if (tx !== this.revealedAt.tx || ty !== this.revealedAt.ty) {
      this.explored.reveal(tx, ty);
      this.revealedAt = { tx, ty };
    }
    const biome = this.world.biomeAt(tx, ty);
    tickEnergy(p, dt, BIOMES[biome].effect);

    for (const ev of collectItems(p, this.world)) {
      if (ev.magnet) {
        this.flyers.push({
          itemId: ev.itemId,
          fromX: ev.tx * TILE_PX + TILE_PX / 2,
          fromY: ev.ty * TILE_PX + TILE_PX / 2,
          t: 0,
        });
      }
    }
    for (const f of this.flyers) f.t += dt / FLYER_SECONDS;
    this.flyers = this.flyers.filter((f) => f.t < 1);

    const change = updateDiscovery(this.discovery, biome, dt);
    if (change) {
      this.hud.toast(BIOMES[change.biome].name, change.isNew ? 'New biome discovered!' : '');
    }

    this.camera.follow(p.x, p.y - CAMERA_OFFSET_Y, dt);
    this.time += dt;
  }

  render(alpha: number): void {
    this.renderer.render({
      player: this.player,
      camera: this.camera,
      flyers: this.flyers,
      time: this.time,
      debugTint: this.debugTint,
      alpha,
    });
    this.hud.update(this.player);
  }

  toSaveData(): SaveData {
    const p = this.player;
    return {
      version: 3,
      seed: this.world.seedText,
      player: {
        x: p.x,
        y: p.y,
        energy: p.energy,
        treasures: p.treasures,
        effects: p.effects.map((e) => ({ ...e })),
      },
      discoveredBiomes: [...this.discovery.discovered],
      chunkDiffs: this.world.exportDiffs(),
      explored: this.explored.serialize(),
    };
  }
}
