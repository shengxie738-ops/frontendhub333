'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useSeamlessMarquee
 * ------------------------------------------------------------------
 * Shared by the /contact greeting band and the /careers photo band.
 *
 * WHY A MARQUEE (evidence, not assumption)
 *   Both components ship, in the frozen server-rendered HTML, exactly TWO
 *   identical tracks of the same items:
 *     /contact  ContactGreeting_main__A_f__
 *               > div.w-full.overflow-hidden > div.flex.items-end
 *               > 65 x <div class="pr-xl-14 shrink-0" id="_0">Hi,</div>
 *               > … ids up to `_64` …
 *               > 65 x <div class="pr-xl-14 shrink-0">Hi,</div>  (NO ids)
 *     /careers  CareersImages_main__ENT6z
 *               > div.w-full.overflow-hidden > div.flex.items-end
 *               > 21 x <div id="_0" class="CareersImages_item__uJrZv shrink-0">
 *               > 21 x <div class="CareersImages_item__uJrZv shrink-0">  (NO ids)
 *
 *   `overflow-hidden` on the viewport is only meaningful if content exceeds it.
 *   `shrink-0` on flex children is only meaningful if the track is translated
 *   past its own box. Duplicating the list is how that translation wraps without
 *   a visible seam. Per-item numeric ids exist on copy 1 only — precisely what
 *   you need in order to measure one period, i.e. the summed width of the first
 *   N children. The CSS module for both components sets `pointer-events:none`
 *   (nothing here is clickable) and ships NO `@keyframes` or `animation` rule at
 *   all, so the movement must be applied from JS.
 *
 *   Conclusion: horizontal, seamless, auto-advancing, non-interactive. That part
 *   is CONFIRMED by the shipped markup and shipped CSS.
 *
 * WHAT IS STILL UNVERIFIED
 *   Speed, direction and easing lived in the /contact and /careers page bundles,
 *   which the evidence bundle never captured (only app/page, app/layout,
 *   app/not-found and app/work/page chunks are present, and
 *   `grep -i 'marquee|gsap|@keyframes'` over them returns nothing). The rate
 *   passed in here is therefore OUR reproducible placeholder, flagged
 *   `rateVerified: false` in `src/content/pages-schema.ts`. Do not describe the
 *   rate as the original's.
 *
 * Implementation notes
 *   All items are direct children of the single `flex items-end` track, exactly
 *   as the source does — this matters on /careers, where `.CareersImages_item__
 *   uJrZv:nth-child(3n+k)` assigns each item its shape by DOM position, and
 *   21 is divisible by 3 so copy 2 continues the square / arch / wide cycle with
 *   no phase shift. One period is the summed `offsetWidth` of the first `period`
 *   children. Phase starts at 0 with no delay, so loads and screenshots are
 *   reproducible. `prefers-reduced-motion` freezes the band as a static list.
 */
export interface MarqueeMeasure {
  /** Attach to the single `flex items-end` track that holds 2 x N items. */
  trackRef: React.RefObject<HTMLDivElement>;
  /** Summed width of one period, CSS px (0 until measured). */
  distance: number;
  /** Seconds for one period at the configured speed. */
  duration: number;
  /** True once a real measurement exists — drives `data-running`. */
  running: boolean;
}

export function useSeamlessMarquee(
  /** Number of items in ONE period; the track must contain 2 x this many children. */
  period: number,
  speedPxPerSecond: number,
  opts: { minDurationSeconds?: number; maxDurationSeconds?: number } = {},
): MarqueeMeasure {
  const trackRef = useRef<HTMLDivElement>(null);
  const [distance, setDistance] = useState(0);

  const minDur = opts.minDurationSeconds ?? 18;
  const maxDur = opts.maxDurationSeconds ?? 400;

  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    if (track.children.length < period) return;
    let w = 0;
    for (let i = 0; i < period; i++) {
      const child = track.children[i] as HTMLElement | undefined;
      if (child) w += child.offsetWidth;
    }
    if (!Number.isFinite(w) || w <= 0) return;
    const next = Math.round(w * 1000) / 1000;
    setDistance((prev) => (Math.abs(prev - next) < 0.5 ? prev : next));
    track.style.setProperty('--mq-dist', `${next}px`);
    const dur = Math.min(maxDur, Math.max(minDur, next / speedPxPerSecond));
    track.style.setProperty('--mq-dur', `${Math.round(dur * 1000) / 1000}s`);
  }, [period, speedPxPerSecond, minDur, maxDur]);

  useEffect(() => {
    measure();
    const track = trackRef.current;
    if (!track) return;
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => measure());
      ro.observe(track);
    }
    // Font swap changes inline metrics; re-measure once webfonts settle.
    if (typeof document !== 'undefined' && 'fonts' in document) {
      document.fonts.ready.then(() => measure()).catch(() => undefined);
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  return {
    trackRef,
    distance,
    duration: speedPxPerSecond > 0 ? distance / speedPxPerSecond : 0,
    running: distance > 0,
  };
}
