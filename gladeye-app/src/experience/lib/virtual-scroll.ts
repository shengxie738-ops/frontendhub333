/**
 * The virtual scroller that drives the camera path, ported verbatim from
 * `evidence/source-assets/js/app/page-4c279de0997d388f.js:3560-4180`
 * (minified `T = e => { ... }`).
 *
 * Behaviour of the live site (EVIDENCE.md §2):
 *  - `html{overflow:hidden}` + `body{position:fixed}` → the document never
 *    scrolls. A `Lenis` instance is created over the hero wrapper purely to
 *    read *virtual* wheel deltas (`{ el, touchMultiplier: 20 }`, and in
 *    lenis@1.1.20 the option is named `wrapper`).
 *  - every virtual-scroll event accumulates into `u += e.deltaY`.
 *  - a drift `u += -5 * l`, with `l` easing towards the auto-scroll target on a
 *    `.25` lerp, is what makes the camera glide through the valley on its own;
 *    `toggleAutoScroll` freezes it while the CTA is hovered. On the live site both
 *    the drift and the 2 % progress smoothing are added once per *rendered* frame,
 *    i.e. once per 1/60 s — which is what the bundle's `min(60, elapsed)` and
 *    `min(frameCount, 10)` clamps were wrapping around that cadence. Here they are
 *    added once per fixed 1/60 s step with a catch-up cap, so a 2 FPS software
 *    renderer travels the same distance per second as a 60 FPS GPU.
 *    `reports/iterations/iteration-02.md` §2 is the root-cause write-up; no
 *    constant moved, only the moment of accumulation.
 *  - progress is `(-u * .2) / a` with `a = Math.min(15 * max(innerWidth, innerHeight), 20000)`,
 *    smoothed by `n += (target - n) * .02` on that same fixed step and wrapped into
 *    `[0,1)` — negative values wrap to the end of the path, exactly like the original.
 */
import Lenis from 'lenis';
import { SCROLLER } from '../data/scene-settings';

/**
 * Fixed-step cadence for the two terms the original added *once per rendered
 * frame* (`iteration-02.md` §2): the auto-drift and the 2 % progress smoothing.
 * At the site's 60 Hz one rendered frame *is* one step, so the per-step terms here
 * equal the ported per-frame expression exactly (`frameScale === 1`,
 * `frameCount === 1` ⇒ `step === drift * l / 1`). Moving them off the render clock
 * is what makes the journey advance at the same rate whatever the FPS — the intent
 * the original's `min(60, elapsed)` / `min(frameCount, 10)` clamps express.
 */
const STEP_MS = 1000 / 60;

/**
 * Catch-up bounds, i.e. how much wall-clock time one rendered frame may settle.
 * 120 steps == two seconds of simulated journey per frame: enough that the drift
 * stays frame-rate independent at the frame times this app actually runs at
 * (SwiftShader renders a 960 k-sprite frame in 0.2–0.5 s, and a screenshot or a
 * probe pass stalls the rAF callback for a second or two more), while a
 * multi-minute stall — a hidden tab, a paused debugger — can never dump thousands
 * of drift steps into `accumulator` in one go. The worst possible single-frame
 * burst is 120 steps = 2 s of journey = 0.006 of `pct`, versus the 495-unit
 * teleport the old per-render-frame accumulation produced (`iteration-02.md` §2).
 */
const MAX_STEPS_PER_FRAME = 120;

/** Wall-clock ms a single frame may admit, so `stepDebtMs` can never outrun the cap. */
const MAX_ADMITTED_MS = MAX_STEPS_PER_FRAME * STEP_MS;

export interface ScrollState {
  normalized: number;
  scrollVelocity: number;
}

export interface VirtualScroll {
  getScrollPct(): ScrollState;
  start(): void;
  onStart(): void;
  onPause(): void;
  destroy(): void;
  toggleAutoScroll(on: boolean): void;
  /** Exposed for the diagnostics bridge. */
  getAccumulator(): number;
  getExtent(): number;
  getScrollStats(): {
    accumulator: number;
    extent: number;
    vsEventCount: number;
    vsDeltaSum: number;
    driftSum: number;
    smoothedPct: number | undefined;
    lastFrameMs: number;
    /** fixed 1/60 s steps actually executed, for the drift-vs-frame audit. */
    stepsRun: number;
    /** ms of wall-clock time still unsimulated (0 unless the cap bit). */
    stepDebtMs: number;
    /** drift steps executed per simulated second, i.e. `1000 / STEP_MS`. */
    stepHz: number;
  };
}

export function createVirtualScroll(el: HTMLElement): VirtualScroll {
  let rafID: number | undefined;
  /** smoothed progress `n`; `undefined` until the first step or the first query. */
  let smoothedPct: number | undefined;
  let lastTime = performance.now();
  let previousScroll = el.scrollTop;
  let scrollVelocity: number = 0;
  /** `a` — the wheel extent, re-derived on resize. */
  let extent: number = SCROLLER.extentCap;
  let autoScrollTarget: number = SCROLLER.autoScrollOn;
  let autoScrollEase: number = SCROLLER.autoScrollOn;
  /** `u` — the accumulated virtual scroll. */
  let accumulator = 0;
  /** wall-clock ms not yet converted into 1/60 s steps. */
  let stepDebtMs = 0;
  /** measurement only: how many virtual-scroll events arrived and their sum. */
  let vsEventCount = 0;
  let vsDeltaSum = 0;
  let driftSum = 0;
  let stepsRun = 0;

  const lenis = new Lenis({
    // `new (Lenis)({ el, touchMultiplier: 20 })` in the bundle; lenis@1.1.20
    // renamed the option to `wrapper`.
    wrapper: el,
    touchMultiplier: SCROLLER.touchMultiplier,
  });

  lenis.on('virtual-scroll', (event) => {
    vsEventCount += 1;
    vsDeltaSum += event.deltaY;
    accumulator += event.deltaY;
  });

  const onResize = (): void => {
    const innerWidth = window.innerWidth;
    const innerHeight = window.innerHeight;
    const pct = accumulator / extent;
    extent = Math.min(
      SCROLLER.extentFactor * Math.max(innerWidth, innerHeight),
      SCROLLER.extentCap,
    );
    accumulator = pct * extent;
  };

  let lastFrameMs = 0;

  /** `t` — the raw progress the smoothing chases: `pct = -u * .2 / a`. */
  function targetPct(): number {
    return (-1 * accumulator * SCROLLER.progressScale) / extent;
  }

  /**
   * `n += (t - n) * .02` — the original's 2 % progress smoothing, now advanced on
   * the fixed step (`.02` itself unchanged). The first step seeds `n` with `t`,
   * matching the original's `n === undefined ? t : n || 0`.
   */
  function stepProgress(): void {
    const target = targetPct();
    const from = smoothedPct === undefined ? target : smoothedPct || 0;
    smoothedPct = from + SCROLLER.progressSmoothing * (target - from);
  }

  /**
   * One 1/60 s tick: the auto-scroll ramp, the drift `u += -5 * l`, and the 2 %
   * progress smoothing. Every constant is the ported original; only the moment it
   * is summed moved off the render clock.
   */
  function step(): void {
    autoScrollEase += (autoScrollTarget - autoScrollEase) * SCROLLER.autoScrollLerp;
    const driftStep = SCROLLER.drift * autoScrollEase;
    accumulator += driftStep;
    driftSum += driftStep;
    stepProgress();
  }

  const raf = (): void => {
    const now = performance.now();
    const elapsed = now - lastTime;
    lastFrameMs = elapsed;
    const delta = accumulator - previousScroll;
    scrollVelocity = (delta / elapsed) * SCROLLER.velocityScale;

    // Fixed-step catch-up: settle the elapsed wall-clock time in 1/60 s ticks.
    // `scrollVelocity` stays a per-ms rate, so it is unaffected by the cadence.
    stepDebtMs += Math.min(Math.max(0, elapsed), MAX_ADMITTED_MS);
    let steps = Math.floor(stepDebtMs / STEP_MS);
    if (steps >= MAX_STEPS_PER_FRAME) {
      // stalled longer than the cap can honestly settle: run the cap, drop the backlog
      steps = MAX_STEPS_PER_FRAME;
      stepDebtMs = 0;
    } else {
      stepDebtMs -= steps * STEP_MS;
    }
    for (let i = 0; i < steps; i++) step();
    stepsRun += steps;

    previousScroll = accumulator;
    lastTime = now;
    rafID = window.requestAnimationFrame(raf);
  };

  window.addEventListener('resize', onResize);
  onResize();

  return {
    getScrollPct(): ScrollState {
      if (smoothedPct === undefined) stepProgress();
      const next = smoothedPct as number;
      // the original's wrap, verbatim: negative progress re-enters at the path end.
      const normalized = Math.sign(next) < 0 ? 1 - (Math.abs(next) % 1) : next % 1;
      return { normalized, scrollVelocity };
    },
    destroy(): void {
      window.removeEventListener('resize', onResize);
      if (rafID !== undefined) window.cancelAnimationFrame(rafID);
      lenis.destroy();
    },
    start(): void {
      lastTime = performance.now();
      rafID = window.requestAnimationFrame(raf);
    },
    onStart(): void {
      lastTime = performance.now();
      rafID = window.requestAnimationFrame(raf);
    },
    onPause(): void {
      if (rafID !== undefined) window.cancelAnimationFrame(rafID);
    },
    toggleAutoScroll(on: boolean): void {
      autoScrollTarget = on ? SCROLLER.autoScrollOn : SCROLLER.autoScrollOff;
    },
    getAccumulator(): number {
      return accumulator;
    },
    getExtent(): number {
      return extent;
    },
    getScrollStats() {
      return {
        accumulator,
        extent,
        vsEventCount,
        vsDeltaSum,
        driftSum,
        smoothedPct,
        lastFrameMs,
        stepsRun,
        stepDebtMs,
        stepHz: 1000 / STEP_MS,
      };
    },
  };
}
