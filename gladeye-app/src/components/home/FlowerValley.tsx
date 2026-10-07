'use client';

import { useState } from 'react';

import { DOM_CLASS_NAMES } from '@/experience/data/scene-settings';
import type { HeroMessage, QualityTier } from '@/experience/types';
import { useFlowerValley } from '@/hooks/useFlowerValley';
import styles from '@/experience/flower-valley.module.css';

import AudioControl from './AudioControl';
import FlowerValleyText from './FlowerValleyText';
import Loader from './Loader';
import ValleyPoster from './ValleyPoster';

/**
 * `FlowerValley` — verbatim DOM of the live hero
 * (`page-4c279de0997d388f.js:41100-41600`, class map at `:42297`, captured
 * structure in `evidence/probe-home-2.json`):
 *
 * ```html
 * <div class="FlowerValley_wrapper__2YGx1">
 *   <div class="js-canvas-container FlowerValley_canvas___rS8E"><canvas data-engine="three.js r154"></canvas></div>
 *   <div class="FlowerValley_textContainer__PZdtA">
 *     <button class="AudioControl_audioButton__Gj5AZ" aria-label="Unmute audio">…</button>
 *     <h2 aria-label="…" role="heading" class="t-hero w-[100%] ">…</h2>
 *     <div class="… FlowerValleyText_cta__3mukC">…</div>
 *   </div>
 *   <div class="FlowerValley_fakeScroller…"></div>
 * </div>
 * ```
 *
 * plus the `<Loader/>` overlay while assets load. `setShowFooter(false)` and the
 * `homepage` html class are handled by the scene (`HomeExperience`) and the page
 * shell respectively.
 */
export interface FlowerValleyProps {
  messages: readonly HeroMessage[];
  /** `story.content.cta` — only `cached_url` is read by the original. */
  cta?: { cached_url?: string; url?: string } | null;
  ctaText: string;
  /** route the CTA points at; the original resolves it from the link field */
  ctaHref?: string;
  /** `aria-label` of the h2 — the raw rich-text markup, exactly as shipped */
  ariaLabel: string;
  quality?: QualityTier;
  enableDormantLayers?: boolean;
}

export default function FlowerValley({
  messages,
  ctaHref = '/work',
  ctaText,
  ariaLabel,
  quality,
  enableDormantLayers,
}: FlowerValleyProps): JSX.Element {
  const [ctaHovered, setCtaHovered] = useState(false);

  const valley = useFlowerValley({
    quality,
    enableDormantLayers,
    messageCount: messages.length,
  });

  const { containerRef, phase, percent, introDone, activeMessage } = valley;

  return (
    <div
      ref={containerRef}
      className={`${styles.wrapper} ${DOM_CLASS_NAMES.flowerValleyWrapper}`}
      data-phase={phase}
    >
      <Loader loading={phase === 'booting'} percent={percent} />

      <div
        className={`${DOM_CLASS_NAMES.canvasContainer} ${styles.canvas} ${DOM_CLASS_NAMES.flowerValleyCanvas}`}
      />

      {phase === 'poster' ? <ValleyPoster ctaHref={ctaHref} /> : null}

      <div className={`${styles.textContainer} ${DOM_CLASS_NAMES.flowerValleyTextContainer}`}>
        {introDone && messages.length > 0 ? (
          <>
            <AudioControl />
            <FlowerValleyText
              messages={messages}
              activeIndex={activeMessage}
              ariaLabel={ariaLabel}
              ctaText={ctaText}
              ctaHref={ctaHref}
              ctaVisible={phase !== 'poster'}
              hovered={ctaHovered}
              onCtaMouseEnter={() => {
                setCtaHovered(true);
                valley.startHoverTransition();
              }}
              onCtaMouseLeave={() => {
                setCtaHovered(false);
                valley.stopHoverTransition();
              }}
              onCtaClick={() => {
                valley.startExitTransition();
              }}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
