'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * `work_bloks_video` / `work_bloks_framed_video` player.
 *
 * The original SSRs a bare element with no `autoplay` and lets the client start it:
 *   <video class="h-full w-full object-cover" src="…/progressive_redirect/…" muted loop playsInline>
 * (verified in `evidence/source-pages/_work_ekos-genesis.html`).
 *
 * This adds `preload="none"` and starts the clip only while it is in the viewport, so a
 * case page with eight framed videos does not download eight 1080p files on load. The
 * element, its attributes and its class list are otherwise the original's.
 */
export default function ClientVideo({
  src,
  className = 'h-full w-full object-cover',
}: {
  src: string;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !src) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) setVisible(e.isIntersecting);
      },
      { rootMargin: '10% 0px 10% 0px', threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [src]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (visible && src) {
      el.preload = 'auto';
      const p = el.play();
      if (p && typeof p.catch === 'function') p.catch(() => undefined);
    } else {
      el.pause();
    }
  }, [visible, src]);

  if (!src) return null;

  return (
    <video
      ref={ref}
      className={className}
      src={src}
      muted
      loop
      playsInline
      preload="none"
      aria-hidden
      style={{ backgroundColor: 'transparent' }}
    />
  );
}
