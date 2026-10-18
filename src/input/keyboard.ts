import { normalize, type Vec2 } from '../core/vec';

const LEFT = ['KeyA', 'ArrowLeft'];
const RIGHT = ['KeyD', 'ArrowRight'];
const UP = ['KeyW', 'ArrowUp'];
const DOWN = ['KeyS', 'ArrowDown'];
const MOVE_CODES = new Set([...LEFT, ...RIGHT, ...UP, ...DOWN]);

/** Uses KeyboardEvent.code (physical key position), so WASD works on any layout. */
export function keysToVector(keys: ReadonlySet<string>): Vec2 {
  const any = (codes: string[]) => codes.some((c) => keys.has(c));
  const x = (any(RIGHT) ? 1 : 0) - (any(LEFT) ? 1 : 0);
  const y = (any(DOWN) ? 1 : 0) - (any(UP) ? 1 : 0);
  return normalize({ x, y });
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
  );
}

export class Keyboard {
  readonly keys = new Set<string>();

  press(code: string): void {
    this.keys.add(code);
  }

  release(code: string): void {
    this.keys.delete(code);
  }

  clear(): void {
    this.keys.clear();
  }

  attach(win: Window): () => void {
    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (MOVE_CODES.has(e.code)) e.preventDefault();
      this.press(e.code);
    };
    const up = (e: KeyboardEvent) => this.release(e.code);
    const blur = () => this.clear();
    win.addEventListener('keydown', down);
    win.addEventListener('keyup', up);
    win.addEventListener('blur', blur);
    return () => {
      win.removeEventListener('keydown', down);
      win.removeEventListener('keyup', up);
      win.removeEventListener('blur', blur);
    };
  }
}
