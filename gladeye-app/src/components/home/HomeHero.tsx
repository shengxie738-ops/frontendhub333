'use client';

import { HERO_COPY } from '@/experience/data/scene-settings';
import type { HeroMessage, RichTextNode } from '@/experience/types';

import FlowerValley from './FlowerValley';

/**
 * `HomeHero` — the `/` route's hero content, assembled from the captured
 * evidence instead of Storyblok (`evidence/probe-home-2.json` aria-label,
 * `docs/research/gladeye/EVIDENCE.md` §2).
 *
 * The rich-text node list below is what produces the live DOM exactly: it
 * flattens (`messageWords`) into `Creative · innovation · <br> · for · a ·
 * regenerative(italic) · future` = 7 words, which is what makes the first
 * character's `--delay` come out as `0.029285714285714286s` on the real site.
 */
const HERO_RICH_TEXT: readonly RichTextNode[] = [
  { type: 'heading', text: 'Creative innovation' },
  { type: 'hard_break' },
  { type: 'heading', text: 'for a ' },
  { type: 'heading', text: 'regenerative', marks: [{ type: 'italic' }] },
  { type: 'heading', text: ' future' },
];

export const HERO_MESSAGES: readonly HeroMessage[] = [
  { _uid: 'hero-0', content: [{ content: HERO_RICH_TEXT }] },
];

export interface HomeHeroProps {
  /** forwarded to the scene: force a placement / post-FX tier */
  quality?: 'high' | 'balanced' | 'boost';
  enableDormantLayers?: boolean;
  ctaHref?: string;
}

export default function HomeHero({
  quality,
  enableDormantLayers,
  ctaHref = '/work',
}: HomeHeroProps): JSX.Element {
  return (
    <FlowerValley
      messages={HERO_MESSAGES}
      cta={{ cached_url: ctaHref }}
      ctaText={HERO_COPY.ctaText}
      ctaHref={ctaHref}
      ariaLabel={HERO_COPY.ariaLabel}
      quality={quality}
      enableDormantLayers={enableDormantLayers}
    />
  );
}
