import type { Vec2 } from '../core/vec';
import { keysToVector, type Keyboard } from './keyboard';

export interface VectorSource {
  readonly vector: Vec2;
}

export class Input {
  constructor(
    private readonly keyboard: Keyboard,
    private readonly joystick: VectorSource,
  ) {}

  /** Movement direction with length <= 1. The joystick wins while it is deflected. */
  direction(): Vec2 {
    const j = this.joystick.vector;
    if (j.x !== 0 || j.y !== 0) return j;
    return keysToVector(this.keyboard.keys);
  }
}
