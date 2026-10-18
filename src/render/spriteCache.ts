/** Sprites are rasterised at the zoom rounded up to this step, then drawn scaled. */
const SCALE_STEP = 0.25;
/** Stale sprites rebuilt per frame after a zoom change (new sprites are always built). */
const REBUILDS_PER_FRAME = 1;

/** Rasterisation scale for a zoom: rounded up so sprites are only ever drawn slightly smaller. */
export function spriteScale(zoom: number): number {
  return Math.ceil(zoom / SCALE_STEP - 1e-9) * SCALE_STEP;
}

/**
 * Caches one rasterised image per sprite definition. Resizes within a scale step reuse the
 * images; a real zoom change rebuilds at most one stale image per frame, drawing the old
 * ones scaled meanwhile, so resizing never stalls a frame.
 */
export class SpriteCache<D, T> {
  private readonly entries = new Map<D, { scale: number; image: T }>();
  private budget = REBUILDS_PER_FRAME;

  constructor(private readonly build: (def: D, scale: number) => T) {}

  beginFrame(): void {
    this.budget = REBUILDS_PER_FRAME;
  }

  get(def: D, zoom: number): T {
    const scale = spriteScale(zoom);
    const hit = this.entries.get(def);
    if (hit && (hit.scale === scale || this.budget <= 0)) return hit.image;
    if (hit) this.budget--;
    const image = this.build(def, scale);
    this.entries.set(def, { scale, image });
    return image;
  }
}
