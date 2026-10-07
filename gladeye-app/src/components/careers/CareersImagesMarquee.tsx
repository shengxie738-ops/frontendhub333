'use client';

import { useSeamlessMarquee } from '@/components/about/useSeamlessMarquee';
import { BlurImage } from '@/components/about/BlurImage';
import type { CareersImage } from '@/content/pages-schema';

/**
 * /careers photo band.
 *
 * INDEPENDENT VERDICT ON THE ARRANGEMENT — the parsed evidence lists 21 images
 * for this route, and the naive reading is "a vertical list / a grid of tiles".
 * It is neither. Two facts settle it:
 *
 *  1. DOM. All 21 sit as siblings inside
 *       <div class="CareersImages_main__ENT6z">
 *         <div class="w-full overflow-hidden">
 *           <div class="flex items-end">
 *             <div id="_0" class="CareersImages_item__uJrZv shrink-0">…
 * They are one horizontal flex row, bottom-aligned, non-shrinking, clipped —
 * and the row appears twice (`_0`..`_20`, then 21 un-idd clones). That is the
 * same seamless-band signature as the /contact greeting, not a gallery.
 *
 *  2. CSS (`/_next/static/css/9085b6f617458941.css`), verbatim:
 *       .CareersImages_main__ENT6z{pointer-events:none;overflow:hidden;
 *         margin-bottom:clamp(8rem,2.4vw + 7.4rem,10rem)}
 *       .CareersImages_item__uJrZv{padding-right:clamp(.625rem,1vw + .4rem,1.5rem)}
 *       .CareersImages_item__uJrZv:nth-child(3n+1) .CareersImages_item-inner__9PDfK
 *         {width:clamp(13.75rem,18.2vw + 9.5rem,38.625rem);aspect-ratio:412/412}
 *       .CareersImages_item__uJrZv:nth-child(3n+2) …
 *         {width:clamp(13.75rem,18.2vw + 9.5rem,38.625rem);
 *          border-top-left-radius:9999px;border-top-right-radius:9999px;
 *          aspect-ratio:412/555}
 *       .CareersImages_item__uJrZv:nth-child(3n+3) …
 *         {width:clamp(19.375rem,25.2vw + 13.5rem,53.8125rem);aspect-ratio:574/412}
 *     So the shapes are a repeating 3-cycle — square, arch-topped portrait,
 *     wide — driven purely by `nth-child`, which only works if every item is a
 *     direct child of the one track. 21 % 3 === 0, so copy 2 continues the
 *     cycle with no phase break. Wrapping the copies in containers would break
 *     this, which is why they are not wrapped.
 *
 * Item boxes are yellow (`bg-yellow`, #FBC500) and the photos inside are
 * `object-fit:cover` on the frozen two-layer blur-up stack.
 */
export function CareersImagesMarquee({
  images,
  speedPxPerSecond = 60,
}: {
  images: CareersImage[];
  speedPxPerSecond?: number;
}) {
  const { trackRef, running } = useSeamlessMarquee(images.length, speedPxPerSecond, {
    minDurationSeconds: 60,
    maxDurationSeconds: 600,
  });

  const renderCopy = (copy: 1 | 2) =>
    images.map((im, i) =>
      copy === 1 ? (
        <div key={`a-${im.id}-${i}`} className='CareersImages_item__uJrZv shrink-0' id={`_${i}`}>
          <div className='CareersImages_item-inner__9PDfK bg-yellow'>
            <BlurImage page='careers' filename={im.filename} alt={im.alt} eager={i < 6} />
          </div>
        </div>
      ) : (
        <div
          key={`b-${im.id}-${i}`}
          className='CareersImages_item__uJrZv shrink-0'
          aria-hidden='true'
        >
          <div className='CareersImages_item-inner__9PDfK bg-yellow'>
            <BlurImage page='careers' filename={im.filename} alt='' eager={false} />
          </div>
        </div>
      ),
    );

  return (
    <div className='CareersImages_main__ENT6z'>
      <div className='w-full overflow-hidden'>
        <div
          ref={trackRef}
          className='flex items-end'
          data-running={running ? 'true' : 'false'}
          data-marquee='careers-images'
          data-copies='2'
          data-items-per-copy={images.length}
          data-rate-verified='false'
        >
          {renderCopy(1)}
          {renderCopy(2)}
        </div>
      </div>
    </div>
  );
}
