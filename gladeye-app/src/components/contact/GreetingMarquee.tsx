'use client';

import { useSeamlessMarquee } from '@/components/about/useSeamlessMarquee';
import { CONTACT_MARQUEE, type ContactGreetings } from '@/content/pages-schema';

/**
 * /contact's signature element: the multilingual greeting band.
 *
 * Structure is a 1:1 copy of the frozen DOM
 * (`evidence/source-pages/_contact.html`, first greeting at byte offset 6083):
 *
 *   <div class="ContactGreeting_main__A_f__">
 *     <div class="w-full overflow-hidden">
 *       <div class="flex items-end">
 *         <div class="pr-xl-14 shrink-0" id="_0">Hi<!-- -->,</div>
 *         … `_1` … `_64` …
 *         <div class="pr-xl-14 shrink-0">Hi<!-- -->,</div>   <- copy 2, no ids
 *         … 64 more …
 *
 * All 130 items are direct children of the one track, as in the source. The
 * `<!-- -->` separators the original shows are React's own SSR text-node
 * markers, which `{g}{','}` reproduces.
 *
 * Motion: captured module 983 sums first-copy clientWidth and uses
 * Math.round(width / 100) seconds for a linear leftward loop. Live Contact
 * samples at 1180×757 on 2026-10-07 measured about 99.865px/s. The hook opts
 * into that rounded timing while using precise rendered width for the seam.
 * Other viewport timing and full visual acceptance are still pending.
 *
 * Accessibility: copy 1 (ids `_0`..`_64`) is the single readable instance; copy
 * 2 exists only to make the wrap seamless and is `aria-hidden`.
 */
export function GreetingMarquee({
  greetings,
  speedPxPerSecond = CONTACT_MARQUEE.speedPxPerSecond,
}: {
  greetings: ContactGreetings;
  speedPxPerSecond?: number;
}) {
  const items = greetings.list;
  const sourceRate = CONTACT_MARQUEE.rateVerified && speedPxPerSecond === CONTACT_MARQUEE.speedPxPerSecond;
  const { trackRef, running } = useSeamlessMarquee(items.length, speedPxPerSecond, {
    contactSourceTiming: true,
  });

  const renderCopy = (copy: 1 | 2) =>
    items.map((g, i) =>
      copy === 1 ? (
        <div key={`a-${i}`} className='pr-xl-14 shrink-0' id={`_${i}`}>
          {g}
          {','}
        </div>
      ) : (
        <div key={`b-${i}`} className='pr-xl-14 shrink-0' aria-hidden='true'>
          {g}
          {','}
        </div>
      ),
    );

  return (
    <div className='ContactGreeting_main__A_f__'>
      <div className='w-full overflow-hidden'>
        <div
          ref={trackRef}
          className='flex items-end'
          data-running={running ? 'true' : 'false'}
          data-marquee='contact-greetings'
          data-copies='2'
          data-items-per-copy={items.length}
          data-rate-verified={sourceRate ? 'true' : 'false'}
          data-timing-evidence={sourceRate ? 'captured-module-983-and-live-1180x757' : 'custom-speed-override'}
        >
          {renderCopy(1)}
          {renderCopy(2)}
        </div>
      </div>
    </div>
  );
}
