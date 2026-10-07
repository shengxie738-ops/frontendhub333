'use client';

import { useEffect, useMemo, useState } from 'react';

import CaseImage from './CaseImage';
import Reveal from './Reveal';
import { prefersReducedMotion } from '@/components/work/motion';
import { workAsset } from '@/components/work/data';

import type { CarouselMediaItem } from '@/content/schema';

/**
 * A single `work_bloks_image` blok that holds several images. The DOM of
 * `_work_ekos-genesis.html` (block 3) and `_work_into-the-amazon.html` (block 16) shows
 * them stacked inside ONE frame — the first layer owns the accent background, the rest
 * are plain overlays at `opacity:0` — so this is a cross-fade deck, not a scroller.
 *
 * The cadence comes from the CMS fields the builder recorded per item
 * (`intervalMs` = how long a slide holds, `durationMs` = the fade; observed values in
 * projects.json: 500/1500/2000/2500/3000 ms, fades 250/333/400/500 ms).
 */
export default function MediaCarousel({ item, slug, accent }: { item: CarouselMediaItem; slug: string; accent: string }) {
  const slides = item.images;
  const interval = item.intervalMs > 0 ? item.intervalMs : 3000;
  const duration = item.durationMs && item.durationMs > 0 ? item.durationMs : 250;
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length < 2 || reduced) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % slides.length), interval);
    return () => window.clearInterval(id);
  }, [slides.length, interval, reduced]);

  if (!slides.length) return null;

  return (
    <>
      {slides.map((slide, i) =>
        i === 0 ? (
          <div key={i} className="absolute inset-0 h-full w-full" style={{ opacity: index === i ? 1 : 0 }}>
            <div className={`h-full w-full ${accent ? '' : 'bg-yellow'}`} style={accent ? { background: accent } : undefined}>
              <Reveal
                offsetY={null}
                duration={duration}
                className="h-full w-full"
                style={{ transitionProperty: 'opacity' }}
              >
                <CaseImage asset={slide} src={workAsset(slug, slide) ?? ''} sizes="100vw" />
              </Reveal>
            </div>
          </div>
        ) : (
          <div
            key={i}
            className="absolute inset-0 h-full w-full"
            style={{
              opacity: index === i ? 1 : 0,
              transitionProperty: 'opacity',
              transitionDuration: `${duration}ms`,
              transitionTimingFunction: 'cubic-bezier(0.165, 0.84, 0.44, 1)',
            }}
          >
            <CaseImage asset={slide} src={workAsset(slug, slide) ?? ''} sizes="100vw" />
          </div>
        ),
      )}
    </>
  );
}
