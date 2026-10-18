import { MAX_ENERGY } from '../config';
import type { EffectKind } from '../data/items';
import type { Player } from '../entities/Player';
import { isTired } from '../systems/energy';

const EFFECT_LABEL: Record<EffectKind, string> = {
  zoom: 'Zoom',
  magnet: 'Magnet',
  sap: 'Sticky',
  wobble: 'Wobbly',
};

function el(doc: Document, id: string): HTMLElement {
  const e = doc.getElementById(id);
  if (!e) throw new Error(`Missing #${id} in index.html`);
  return e;
}

export class Hud {
  private readonly energyFill: HTMLElement;
  private readonly treasures: HTMLElement;
  private readonly effects: HTMLElement;
  private readonly tired: HTMLElement;
  private readonly toastEl: HTMLElement;
  private readonly toastTitle: HTMLElement;
  private readonly toastSub: HTMLElement;
  private readonly noticeEl: HTMLElement;
  private noticeTimer: number | undefined;
  private last = { energy: '', treasures: '', effects: '', tired: false };

  constructor(doc: Document) {
    this.energyFill = el(doc, 'energy-fill');
    this.treasures = el(doc, 'treasures');
    this.effects = el(doc, 'effects');
    this.tired = el(doc, 'tired-hint');
    this.toastEl = el(doc, 'toast');
    this.toastTitle = el(doc, 'toast-title');
    this.toastSub = el(doc, 'toast-sub');
    this.noticeEl = el(doc, 'notice');
  }

  /** Called every frame; only touches the DOM when something changed. */
  update(p: Player): void {
    const energy = `${Math.round((p.energy / MAX_ENERGY) * 100)}%`;
    const treasures = `Treasures: ${p.treasures}`;
    const effects = p.effects
      .filter((e) => e.kind !== 'wobble')
      .map((e) => `${EFFECT_LABEL[e.kind]} ${Math.ceil(e.remaining)}s`)
      .join(' · ');
    const tired = isTired(p);
    if (energy !== this.last.energy) this.energyFill.style.width = energy;
    if (treasures !== this.last.treasures) this.treasures.textContent = treasures;
    if (effects !== this.last.effects) this.effects.textContent = effects;
    if (tired !== this.last.tired) this.tired.hidden = !tired;
    this.last = { energy, treasures, effects, tired };
  }

  toast(title: string, subtitle = ''): void {
    this.toastTitle.textContent = title;
    this.toastSub.textContent = subtitle;
    this.toastEl.classList.remove('show');
    void this.toastEl.offsetWidth; // restart the CSS animation
    this.toastEl.classList.add('show');
  }

  notice(text: string, seconds = 6): void {
    this.noticeEl.textContent = text;
    this.noticeEl.hidden = false;
    window.clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => (this.noticeEl.hidden = true), seconds * 1000);
  }
}
