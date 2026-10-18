import type { Vec2 } from '../core/vec';

const DEAD_ZONE = 0.1;
/** Touches starting in the left 60% of the surface control the joystick. */
const ACTIVE_FRACTION = 0.6;

export function joystickVector(dx: number, dy: number, radius: number, deadZone: number): Vec2 {
  const len = Math.hypot(dx, dy);
  if (len < deadZone * radius) return { x: 0, y: 0 };
  const m = Math.min(len, radius) / radius;
  return { x: (dx / len) * m, y: (dy / len) * m };
}

/** Floating joystick: appears where the thumb lands, follows until release. */
export class TouchJoystick {
  vector: Vec2 = { x: 0, y: 0 };
  private pointerId: number | null = null;
  private originX = 0;
  private originY = 0;

  constructor(private readonly radiusCss = 56) {}

  attach(surface: HTMLElement, base: HTMLElement, knob: HTMLElement): () => void {
    const place = (el: HTMLElement, x: number, y: number) => {
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    };
    const reset = () => {
      this.pointerId = null;
      this.vector = { x: 0, y: 0 };
      base.hidden = true;
      knob.hidden = true;
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || this.pointerId !== null) return;
      if (e.clientX > surface.clientWidth * ACTIVE_FRACTION) return;
      this.pointerId = e.pointerId;
      this.originX = e.clientX;
      this.originY = e.clientY;
      surface.setPointerCapture(e.pointerId);
      place(base, e.clientX, e.clientY);
      place(knob, e.clientX, e.clientY);
      base.hidden = false;
      knob.hidden = false;
      e.preventDefault();
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== this.pointerId) return;
      const dx = e.clientX - this.originX;
      const dy = e.clientY - this.originY;
      this.vector = joystickVector(dx, dy, this.radiusCss, DEAD_ZONE);
      const len = Math.hypot(dx, dy);
      const k = len > this.radiusCss ? this.radiusCss / len : 1;
      place(knob, this.originX + dx * k, this.originY + dy * k);
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId === this.pointerId) reset();
    };
    surface.addEventListener('pointerdown', down);
    surface.addEventListener('pointermove', move);
    surface.addEventListener('pointerup', up);
    surface.addEventListener('pointercancel', up);
    reset();
    return () => {
      surface.removeEventListener('pointerdown', down);
      surface.removeEventListener('pointermove', move);
      surface.removeEventListener('pointerup', up);
      surface.removeEventListener('pointercancel', up);
    };
  }
}
