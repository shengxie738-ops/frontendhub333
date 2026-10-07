"use client";

/**
 * GSAP wrapper for the shell.
 *
 * Two reasons this exists instead of calling GSAP directly:
 *   1. the original site's easings are Framer Motion cubic-béziers
 *      (`[.165,.84,.44,1]` etc.) — registering them once keeps every timeline
 *      on the same curve as `transitionTimingFunction.DEFAULT` in the Tailwind
 *      theme; and
 *   2. `prefers-reduced-motion` must short-circuit large shell motion without
 *      removing content or navigation.
 *
 * Durations below are the verbatim values from `evidence/source-assets/js/app/`
 * `layout-3ab4cf37f3ac757c.js` (the original menu variants).
 */
import { gsap } from "gsap";

import { prefersReducedMotion } from "./use-prefers-reduced-motion";

/** Named easings, from the original Framer Motion arrays. */
export const EASE = {
  /** `[.165, .84, .44, 1]` — the site-wide default (`transitionTimingFunction.DEFAULT`). */
  theme: "gladeye.theme",
  /** `[0, .55, .45, 1]` — menu backdrop wipe. */
  menuWipe: "gladeye.menuWipe",
  /** `[.895, .03, .685, .22]` — menu item / meta exit. */
  menuExit: "gladeye.menuExit",
} as const;

/** Verbatim durations (seconds) of the original shell transitions. */
export const DURATION = {
  /** `.duration-theme` — every theme colour cross-fade. */
  theme: 0.5,
  menuBackdrop: 0.45,
  menuItemIn: 0.45,
  menuItemOut: 0.225,
  menuStagger: 0.02475,
  menuStaggerDelay: 0.2025,
  menuMetaIn: 0.45,
  menuMetaOut: 0.1125,
  menuMetaDelay: 0.3375,
  /** Theme restore lag after the menu closes (`setTimeout(..., 450)`). */
  themeRestore: 0.45,
} as const;

let registered = false;

export function registerGladeyeEases(): void {
  if (registered || typeof window === "undefined") return;
  registered = true;
  gsap.registerEase(EASE.theme, (p) => cubicBezier(0.165, 0.84, 0.44, 1)(p));
  gsap.registerEase(EASE.menuWipe, (p) => cubicBezier(0, 0.55, 0.45, 1)(p));
  gsap.registerEase(EASE.menuExit, (p) => cubicBezier(0.895, 0.03, 0.685, 0.22)(p));
}

/** Newton-Raphson cubic-bézier solver (same approach GSAP's CustomEase uses). */
function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const sampleDerivativeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  return (progress: number): number => {
    if (progress <= 0) return 0;
    if (progress >= 1) return 1;
    let t = progress;
    for (let i = 0; i < 8; i += 1) {
      const x = sampleX(t) - progress;
      if (Math.abs(x) < 1e-6) break;
      const d = sampleDerivativeX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= x / d;
    }
    return sampleY(t);
  };
}

export interface ShellTween {
  readonly kill: () => void;
  readonly progress: (value?: number) => number | undefined;
}

/**
 * An interruptible tween: re-running it while in flight retargets from the
 * current values rather than restarting, which is what makes the menu overlay
 * feel responsive when the button is hammered.
 */
export function shellTween(
  targets: gsap.TweenTarget,
  vars: gsap.TweenVars,
): ShellTween | null {
  if (typeof window === "undefined") return null;
  registerGladeyeEases();
  const reduced = prefersReducedMotion();
  const tween = gsap.to(targets, {
    ...vars,
    ...(reduced ? { duration: 0, delay: 0 } : null),
    overwrite: "auto",
  });
  return {
    kill: () => tween.kill(),
    progress: (value?: number) => {
      if (value === undefined) return tween.progress();
      tween.progress(value);
      return value;
    },
  };
}

/** Jump straight to the resting state when motion is reduced. */
export function settleIfReduced(
  targets: gsap.TweenTarget,
  vars: gsap.TweenVars,
): boolean {
  if (!prefersReducedMotion() || typeof window === "undefined") return false;
  gsap.set(targets, vars);
  return true;
}

export { gsap };
