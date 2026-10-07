'use client';

/**
 * Minimal motion primitives for /work and /work/[slug].
 *
 * The original drives its pointer-following previews and scroll reveals with
 * `framer-motion` (`m.E.div` + `useSpring` + `useTransform`) and `gsap`
 * (`(0,T.j)(...)` for the volume fade). `framer-motion` is not a dependency of this
 * project, so the *same* numbers are re-implemented here against the DOM directly:
 *
 *   FeatureList box spring      — damping 50,  stiffness 1000  (chunk 394, module 4394)
 *   ColoredDotCursor spring     — damping 100, stiffness 1000, bounce 1
 *                                 (chunk app/work/page, module 1959 `N`)
 *   Featured card scroll spring — stiffness 200, damping 30    (`useScroll` + `useSpring`)
 *
 * Springs are integrated per frame and written straight to `element.style`, so a
 * pointermove never triggers a React render (which is how the original behaves too).
 */

export interface SpringOptions {
  stiffness: number;
  damping: number;
  mass?: number;
}

export class Spring {
  value: number;
  private target: number;
  private velocity = 0;
  private readonly stiffness: number;
  private readonly damping: number;
  private readonly mass: number;

  constructor(initial: number, { stiffness, damping, mass = 1 }: SpringOptions) {
    this.value = initial;
    this.target = initial;
    this.stiffness = stiffness;
    this.damping = damping;
    this.mass = mass;
  }

  set(target: number) {
    this.target = target;
  }

  jump(v: number) {
    this.value = v;
    this.target = v;
    this.velocity = 0;
  }

  /** Semi-implicit Euler, clamped to 64 ms so a backgrounded tab cannot explode. */
  step(dtMs: number): number {
    const dt = Math.min(0.064, dtMs / 1000);
    const acceleration = (-this.stiffness * (this.value - this.target) - this.damping * this.velocity) / this.mass;
    this.velocity += acceleration * dt;
    this.value += this.velocity * dt;
    return this.value;
  }

  get done(): boolean {
    return Math.abs(this.velocity) < 0.001 && Math.abs(this.value - this.target) < 0.001;
  }
}

/**
 * Runs a rAF loop while it is needed. The loop stops itself once every spring has
 * settled, so an idle page costs nothing (the original keeps a ticker alive the
 * whole time; stopping is strictly cheaper and visually identical).
 */
export function startTicker(tick: (dtMs: number) => boolean | void): () => void {
  let raf = 0;
  let last = 0;
  let alive = true;
  const loop = (now: number) => {
    if (!alive) return;
    const dt = last ? now - last : 16.7;
    last = now;
    const keepGoing = tick(dt);
    if (keepGoing === false) {
      alive = false;
      return;
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => {
    alive = false;
    cancelAnimationFrame(raf);
  };
}

/** `@media (hover: hover)` — the same gate the original's CSS uses for every roll-over. */
export function canUseHover(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Port of `useScroll({target, offset:["start end","end end"]})` from the featured
 * card: 0 when the element's top enters the bottom of the viewport, 1 when its
 * bottom leaves the top.
 */
export function scrollProgress(el: HTMLElement): number {
  const rect = el.getBoundingClientRect();
  const vh = window.innerHeight || 1;
  const total = vh + rect.height;
  const p = (vh - rect.top) / total;
  return Math.max(0, Math.min(1, p));
}
