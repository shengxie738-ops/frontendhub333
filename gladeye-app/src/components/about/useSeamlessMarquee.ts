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
 * TIMING PROVENANCE
 *   Contact module 983 in the captured 785-3ec288b614fa287f.js sums the
 *   first-copy clientWidth values and rounds width / 100 to whole seconds.
 *   Live Contact at 1180×757 on 2026-10-07 moved left at about 99.865px/s.
 *   Contact opts into that unbounded rounded timing. Its travel distance uses
 *   rendered fractional widths to avoid an integer-rounding seam; that is an
 *   intentional clone precision improvement, not the source measurement API.
 *   Careers keeps the existing bounded placeholder timing and offsetWidth
 *   measurement. Contact's four target viewport checks remain pending.
 *
 * Implementation notes
 *   All items are direct children of the single `flex items-end` track, exactly
 *   as the source does — this matters on /careers, where `.CareersImages_item__
 *   uJrZv:nth-child(3n+k)` assigns each item its shape by DOM position, and
 *   21 is divisible by 3 so copy 2 continues the square / arch / wide cycle with
 *   no phase shift. One period sums the first `period` children: offsetWidth
 *   by default, fractional rendered width for Contact. Phase starts at 0 with
 *   no delay. Existing CSS supplies the linear left loop and reduced-motion
 *   fallback. Observers and pending resize/font callbacks are cleaned up.
 */
export interface MarqueeMeasure {
  /** Attach to the single `flex items-end` track that holds 2 x N items. */
  trackRef: React.RefObject<HTMLDivElement>;
  /** Summed width of one period, CSS px (0 until measured). */
  distance: number;
  /** Contact's applied rounded duration; legacy consumers retain distance/speed. */
  duration: number;
  /** True once a real measurement exists — drives `data-running`. */
  running: boolean;
}

export function useSeamlessMarquee(
  /** Number of items in ONE period; the track must contain 2 x this many children. */
  period: number,
  speedPxPerSecond: number,
  opts: {
    minDurationSeconds?: number;
    maxDurationSeconds?: number;
    /** Opt-in Contact source timing; legacy consumers retain their existing bounds. */
    contactSourceTiming?: boolean;
  } = {},
): MarqueeMeasure {
  const trackRef = useRef<HTMLDivElement>(null);
  const [distance, setDistance] = useState(0);
  const [contactDuration, setContactDuration] = useState(0);

  const contactSourceTiming = opts.contactSourceTiming ?? false;
  const minDur = opts.minDurationSeconds ?? 18;
  const maxDur = opts.maxDurationSeconds ?? 400;

  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track || period <= 0 || track.children.length < period) return;
    let w = 0;
    let timingWidth = 0;
    for (let i = 0; i < period; i++) {
      const child = track.children[i] as HTMLElement;
      w += contactSourceTiming ? child.getBoundingClientRect().width : child.offsetWidth;
      if (contactSourceTiming) timingWidth += child.clientWidth;
    }
    if (!Number.isFinite(w) || w <= 0) return;
    if (contactSourceTiming && (!Number.isFinite(speedPxPerSecond) || speedPxPerSecond <= 0)) return;
    // Retain fractional layout widths for Contact; rounding here only removes
    // floating-point summation noise, well below a browser layout subpixel.
    const next = contactSourceTiming
      ? Math.round(w * 1_000_000) / 1_000_000
      : Math.round(w * 1000) / 1000;
    const dur = contactSourceTiming
      ? Math.round(timingWidth / speedPxPerSecond)
      : Math.min(maxDur, Math.max(minDur, next / speedPxPerSecond));
    if (contactSourceTiming && (!Number.isFinite(dur) || dur <= 0)) return;
    setDistance((prev) => {
      if (contactSourceTiming) return prev === next ? prev : next;
      return Math.abs(prev - next) < 0.5 ? prev : next;
    });
    if (contactSourceTiming) setContactDuration(dur);
    track.style.setProperty('--mq-dist', `${next}px`);
    track.style.setProperty('--mq-dur', `${Math.round(dur * 1000) / 1000}s`);
  }, [period, speedPxPerSecond, minDur, maxDur, contactSourceTiming]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let active = true;
    const remeasure = () => {
      if (active) measure();
    };
    remeasure();
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(remeasure);
      observer.observe(track);
      // The track itself remains viewport-wide while overflowing glyphs can
      // change width independently during a font swap or responsive change.
      if (contactSourceTiming) {
        for (let i = 0; i < period && i < track.children.length; i++) {
          observer.observe(track.children[i]);
        }
      }
    }
    const fonts = typeof document !== 'undefined' && 'fonts' in document ? document.fonts : undefined;
    fonts?.ready.then(remeasure).catch(() => undefined);
    if (contactSourceTiming) fonts?.addEventListener('loadingdone', remeasure);
    window.addEventListener('resize', remeasure);
    return () => {
      active = false;
      observer?.disconnect();
      window.removeEventListener('resize', remeasure);
      if (contactSourceTiming) fonts?.removeEventListener('loadingdone', remeasure);
    };
  }, [measure, period, contactSourceTiming]);

  return {
    trackRef,
    distance,
    duration: contactSourceTiming ? contactDuration : speedPxPerSecond > 0 ? distance / speedPxPerSecond : 0,
    running: distance > 0,
  };
}
