import './style.css';
import { AUTOSAVE_SECONDS, MAX_TICKS_PER_FRAME, TICK_DT } from './config';
import { startLoop } from './core/loop';
import { BIOMES } from './data/biomes';
import { Game } from './Game';
import { Input } from './input/Input';
import { Keyboard } from './input/keyboard';
import { TouchJoystick } from './input/touchJoystick';
import { Renderer } from './render/Renderer';
import { downloadSave, readSaveFile } from './save/fileio';
import { getBrowserStore, loadSave, writeSave } from './save/storage';
import { randomSeedText } from './seedWords';
import { DebugOverlay } from './ui/debugOverlay';
import { Hud } from './ui/hud';
import { Menu } from './ui/menu';

function el<T extends HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Missing #${id} in index.html`);
  return e as T;
}

const canvas = el<HTMLCanvasElement>('game');
const store = getBrowserStore();
const hud = new Hud(document);
const keyboard = new Keyboard();
keyboard.attach(window);
const joystick = new TouchJoystick();
joystick.attach(canvas, el('joy-base'), el('joy-knob'));
const renderer = new Renderer(canvas);
const game = new Game(renderer, hud, new Input(keyboard, joystick));
const debug = new DebugOverlay(el('debug'), new URLSearchParams(location.search).has('debug'));

const resize = () =>
  renderer.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio);
window.addEventListener('resize', resize);
resize();

const save = () => {
  if (store && !writeSave(store, game.toSaveData())) {
    hud.notice('Could not save — browser storage is full.');
  }
};

const loaded = store ? loadSave(store) : ({ status: 'empty' } as const);
if (loaded.status === 'ok') {
  game.load(loaded.data);
} else {
  game.newWorld(randomSeedText());
  if (loaded.status === 'corrupt') {
    hud.notice('Your save could not be read. A backup was kept and a new world started.');
  }
}
if (!store) hud.notice("Saving isn't available in this browser mode — progress won't persist.");

let autosave = 0;
let fps = 60;
const loop = startLoop(
  TICK_DT,
  MAX_TICKS_PER_FRAME,
  (dt) => {
    game.update(dt);
    autosave += dt;
    if (autosave >= AUTOSAVE_SECONDS) {
      autosave = 0;
      save();
    }
  },
  (frameSeconds) => {
    game.render();
    if (frameSeconds > 0) fps = fps * 0.9 + (1 / frameSeconds) * 0.1;
    if (debug.visible) {
      const p = game.player;
      const tx = p.tileX();
      const ty = p.tileY();
      const cl = game.world.generator.field.climateAt(tx, ty);
      const r = renderer.stats();
      debug.update({
        fps: fps.toFixed(0),
        seed: game.world.seedText,
        tile: `${tx}, ${ty}`,
        biome: BIOMES[game.world.biomeAt(tx, ty)].name,
        climate: `e ${cl.elevation.toFixed(2)} t ${cl.temperature.toFixed(2)} m ${cl.moisture.toFixed(2)} l ${cl.landmark.toFixed(2)}`,
        chunks: game.world.loadedChunkCount,
        baked: `${r.bakedCanvases} (+${r.bakesThisFrame} this frame)`,
        zoom: renderer.zoom,
        tint: game.debugTint ? 'on (B)' : 'off (B)',
      });
    }
  },
);

const menu = new Menu(
  document,
  {
    onOpen: () => loop.setPaused(true),
    onClose: () => loop.setPaused(false),
    newWorld: (seedText) => {
      game.newWorld(seedText || randomSeedText());
      menu.setSeed(game.world.seedText);
      save();
    },
    exportSave: () => downloadSave(game.toSaveData()),
    importSave: (file) => {
      readSaveFile(file)
        .then((data) => {
          game.load(data);
          menu.setSeed(data.seed);
          save();
          hud.notice('Save imported.');
        })
        .catch(() => hud.notice("That file isn't a valid Gizmo save. Nothing was changed."));
    },
  },
  { storageAvailable: store !== null },
);
menu.setSeed(game.world.seedText);

window.addEventListener('keydown', (e) => {
  if (e.code === 'F3') {
    e.preventDefault();
    debug.toggle();
  } else if (e.code === 'KeyB' && debug.visible) {
    game.debugTint = !game.debugTint;
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    save();
    loop.setPaused(true);
  } else if (!menu.isOpen) {
    loop.setPaused(false);
  }
});
window.addEventListener('pagehide', save);
