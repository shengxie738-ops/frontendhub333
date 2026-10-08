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

  /**
   * Exact damped-spring solution while the sampled target is fixed for this step.
   * This keeps the same k/c/m response at 30/60/120 Hz without Euler instability
   * or another smoothing layer. Keep the 64 ms effective-time cap for tab gaps.
   */
  step(dtMs: number): number {
    const dt = Math.min(0.064, dtMs / 1000);
    if (!(dt > 0)) return this.value;
    const displacement = this.value - this.target;
    const velocity = this.velocity;
    const alpha = this.damping / (2 * this.mass);
    const omegaSquared = this.stiffness / this.mass;
    const discriminant = alpha * alpha - omegaSquared;

    if (discriminant > 0) {
      const root = Math.sqrt(discriminant);
      // The rationalized slow root and expm1 avoid cancellation, including
      // near-critical damping. Decaying exponentials cannot overflow as cosh can.
      const slow = -omegaSquared / (alpha + root);
      const fast = -alpha - root;
      const fastDecay = Math.exp(fast * dt);
      const response = Math.exp(slow * dt) * -Math.expm1(-2 * root * dt) / (2 * root);
      const coefficient = velocity - fast * displacement;
      this.value = this.target + displacement * fastDecay + coefficient * response;
      this.velocity = velocity * fastDecay + slow * coefficient * response;
    } else if (discriminant < 0) {
      const omega = Math.sqrt(-discriminant);
      const decay = Math.exp(-alpha * dt);
      const cosine = Math.cos(omega * dt);
      const response = Math.sin(omega * dt) / omega;
      this.value = this.target + decay * (displacement * cosine + (velocity + alpha * displacement) * response);
      this.velocity = decay * (velocity * cosine - (alpha * velocity + omegaSquared * displacement) * response);
    } else {
      const decay = Math.exp(-alpha * dt);
      const coefficient = velocity + alpha * displacement;
      this.value = this.target + (displacement + coefficient * dt) * decay;
      this.velocity = (velocity - alpha * coefficient * dt) * decay;
    }
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

/** Layout-space viewport top, matching the source scroll engine's offset chain.
 * Painted frame/cropper scale must never feed back into the reveal target. */
export function layoutTop(el: HTMLElement): number {
  let top = 0;
  let node: HTMLElement | null = el;
  while (node && node !== document.documentElement) {
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return top - window.scrollY;
}

/**
 * Port of `useScroll({target, offset:["start end","end end"]})`: 0 when the
 * layout top reaches the viewport bottom, 1 when the layout bottom reaches it.
 * The original scroll engine also measures target.clientHeight, without scale.
 */
export function scrollProgress(el: HTMLElement): number {
  const vh = window.innerHeight || 1;
  const height = el.clientHeight;
  if (height <= 0) return 0;
  const p = (vh - layoutTop(el)) / height;
  return Math.max(0, Math.min(1, p));
}
