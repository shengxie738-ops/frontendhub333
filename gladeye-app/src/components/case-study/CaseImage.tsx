'use client';

import { useState } from 'react';

import BlockedMedia from './BlockedMedia';
import { blockedWorkAsset } from '@/content/schema';

import type { ImageAsset } from '@/content/schema';

/**
 * Same two-layer markup as the original `next/image` fill renderer: a 20px-wide blurred
 * placeholder under the real asset, both painted into the frame with
 * object-fit:cover / object-position:50% 50%, the pair fading in when the real file loads.
 * The container's aspect ratio comes from the DOM frame class (recorded per item), so the
 * crop of natural-vs-frame ratio is visible rather than hidden.
 *
 * An asset the origin no longer serves is *not* drawn: `blockedWorkAsset` recognises it and
 * a labelled blocked frame is painted instead, so the page states what is missing rather
 * than showing a broken image or somebody else's picture.
 */
export default function CaseImage({
  asset,
  src,
  sizes = '100vw',
  priority = false,
  className = '',
  placeholderColor,
}: {
  asset: ImageAsset | null | undefined;
  /** local public path of the downloaded asset */
  src: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
  /** the frame's verbatim `frameBackground`, used for the under-layer */
  placeholderColor?: string | null;
}) {
  const [loaded, setLoaded] = useState(false);
  if (!asset) return null;
  const blocked = blockedWorkAsset(src);
  if (blocked)
    return (
      <div className={`relative overflow-hidden h-full w-full ${className}`.trim()}>
        <BlockedMedia asset={src} reason={blocked} />
      </div>
    );
  const fillStyle: React.CSSProperties = {
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
  };
  return (
    <div className={`relative overflow-hidden h-full w-full ${className}`.trim()}>
      {/* The original stacks a /m/20x0 Storyblok thumbnail under the real asset.
          Those 600+ tiny variants were never localised and hotlinking the origin
          would break the offline requirement, so the frame's own verbatim
          background colour is used instead. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          position: 'absolute',
          height: '100%',
          width: '100%',
          inset: 0,
          backgroundColor: placeholderColor ?? '#000',
        }}
      />
      <img
        ref={(node) => {
          // Locally served images frequently finish decoding before React
          // attaches onLoad, which left the sharp layer at opacity:0 forever.
          if (node && node.complete && node.naturalWidth > 0) setLoaded(true);
        }}
        alt={asset.alt || 'Gladeye'}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className="transition-all duration-750 ease-in-out"
        style={{ ...fillStyle, opacity: loaded ? 1 : 0 }}
        src={src}
        sizes={sizes}
        data-natural={`${asset.naturalWidth ?? '?'}x${asset.naturalHeight ?? '?'}`}
      />
    </div>
  );
}
