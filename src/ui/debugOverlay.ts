const REFRESH_MS = 250;

export class DebugOverlay {
  private lastUpdate = 0;

  constructor(
    private readonly el: HTMLElement,
    public visible: boolean,
  ) {
    el.hidden = !visible;
  }

  toggle(): void {
    this.visible = !this.visible;
    this.el.hidden = !this.visible;
  }

  /** Throttled to avoid layout work every frame. */
  update(lines: Record<string, string | number>): void {
    if (!this.visible) return;
    const now = performance.now();
    if (now - this.lastUpdate < REFRESH_MS) return;
    this.lastUpdate = now;
    this.el.textContent = Object.entries(lines)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
  }
}
