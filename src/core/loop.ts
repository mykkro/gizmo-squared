import { MAX_FRAME_SECONDS } from '../config';

export interface AccumulatorResult {
  ticks: number;
  accumulator: number;
}

/** Fixed-timestep bookkeeping: how many ticks to run for this frame. */
export function stepAccumulator(
  accumulator: number,
  frameSeconds: number,
  tickSeconds: number,
  maxTicks: number,
): AccumulatorResult {
  let acc = accumulator + Math.min(Math.max(frameSeconds, 0), MAX_FRAME_SECONDS);
  let ticks = Math.floor(acc / tickSeconds);
  acc = Math.max(0, acc - ticks * tickSeconds);
  if (ticks > maxTicks) {
    ticks = maxTicks;
    acc = 0;
  }
  return { ticks, accumulator: acc };
}

export interface LoopHandle {
  stop(): void;
  setPaused(paused: boolean): void;
}

export function startLoop(
  tickSeconds: number,
  maxTicks: number,
  update: (dt: number) => void,
  render: (frameSeconds: number, alpha: number) => void,
): LoopHandle {
  let acc = 0;
  let last = performance.now();
  let paused = false;
  let running = true;

  const frame = (now: number) => {
    if (!running) return;
    const frameSeconds = (now - last) / 1000;
    last = now;
    if (!paused) {
      const r = stepAccumulator(acc, frameSeconds, tickSeconds, maxTicks);
      acc = r.accumulator;
      for (let i = 0; i < r.ticks; i++) update(tickSeconds);
    }
    render(frameSeconds, acc / tickSeconds);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  return {
    stop: () => {
      running = false;
    },
    setPaused: (p) => {
      paused = p;
      last = performance.now();
      acc = 0;
    },
  };
}
