'use client';

import { useSeamlessMarquee } from '@/components/about/useSeamlessMarquee';
import type { ContactGreetings } from '@/content/pages-schema';

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
 * Motion: horizontal seamless band, CONFIRMED structurally (see
 * `useSeamlessMarquee.ts`); the rate is our documented placeholder and is NOT
 * an original value.
 *
 * Accessibility: copy 1 (ids `_0`..`_64`) is the single readable instance; copy
 * 2 exists only to make the wrap seamless and is `aria-hidden`.
 */
export function GreetingMarquee({
  greetings,
  speedPxPerSecond = 60,
}: {
  greetings: ContactGreetings;
  speedPxPerSecond?: number;
}) {
  const items = greetings.list;
  const { trackRef, running } = useSeamlessMarquee(items.length, speedPxPerSecond, {
    minDurationSeconds: 40,
    maxDurationSeconds: 400,
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
          data-rate-verified='false'
        >
          {renderCopy(1)}
          {renderCopy(2)}
        </div>
      </div>
    </div>
  );
}
