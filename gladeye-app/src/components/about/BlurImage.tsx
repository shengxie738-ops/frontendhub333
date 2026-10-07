'use client';

import { useEffect, useRef, useState } from 'react';

import { localLqip, localSrc, type InfoPage } from './localAsset';

/**
 * Reproduces the frozen two-layer image the original site emits for every
 * Storyblok asset. Verbatim DOM shape from _about.html / _careers.html:
 *
 *   <div class="relative overflow-hidden h-full w-full">
 *     <img src="…/m/20x0" alt="Placeholder" class="blur-lg transition-all duration-750 ease-in-out" …>
 *     <img src="…"        alt="Gladeye"      class="blur-lg transition-all duration-750 ease-in-out" …>
 *   </div>
 *
 * Both layers are absolutely positioned with `object-fit:cover` and
 * `object-position:50% 50%`; the sharp layer un-blurs on load, which is what
 * the shared `transition-all duration-750 ease-in-out` pair is for.
 *
 * `next/image` is deliberately not used: the app's `next.config.mjs` has no
 * `images.remotePatterns`, and the point here is to render the real downloaded
 * bytes rather than a runtime-optimised proxy of the origin site.
 */
export function BlurImage({
  page,
  filename,
  alt = 'Gladeye',
  eager = false,
}: {
  page: InfoPage;
  filename: string;
  alt?: string;
  eager?: boolean;
}) {
  return (
    <div className='relative overflow-hidden h-full w-full'>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={localLqip(page, filename)}
        alt='Placeholder'
        aria-hidden='true'
        className='blur-lg transition-all duration-750 ease-in-out'
        style={{
          position: 'absolute',
          height: '100%',
          width: '100%',
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          objectFit: 'cover',
          objectPosition: '50% 50%',
          color: 'transparent',
        }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <SharpLayer
        src={localSrc(page, filename)}
        alt={alt}
        eager={eager}
      />
      {/*
        The original keeps `blur-lg` on the sharp layer and lets JS drop it
        once the bytes decode, which is what the `transition-all duration-750
        ease-in-out` pair is for. `SharpLayer` reproduces that, with the
        `complete` check added: a locally served asset can finish decoding
        before React attaches `onLoad`, and then the handler never fires —
        which left every photo on /about and /careers permanently blurred.
      */}
    </div>
  );
}

/** The un-blur step, kept in its own client component so the ref/state pair
 *  sits on the element that actually needs it. */
function SharpLayer({ src, alt, eager }: { src: string; alt: string; eager: boolean }) {
  const ref = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (ref.current?.complete) setLoaded(true);
  }, []);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding={eager ? 'sync' : 'async'}
      className='blur-lg transition-all duration-750 ease-in-out'
      style={{
        position: 'absolute',
        height: '100%',
        width: '100%',
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        objectFit: 'cover',
        objectPosition: '50% 50%',
        color: 'transparent',
        ...(loaded ? { filter: 'none' } : {}),
      }}
      onLoad={(e) => {
        setLoaded(true);
        e.currentTarget.style.filter = 'none';
      }}
    />
  );
}

