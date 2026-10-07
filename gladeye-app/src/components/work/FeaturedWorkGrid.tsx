'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

import MotionLink from './MotionLink';
import { canUseHover, prefersReducedMotion, scrollProgress, Spring, startTicker } from './motion';

import type { FeaturedCard } from '@/content/schema';

/* ------------------------------------------------------------------ layers -- */

export type CardLayer =
  | { kind: 'image'; src: string; alt: string; naturalWidth: number | null; naturalHeight: number | null }
  | { kind: 'video'; source: string; vimeoId: string | null };

const storyblokLocal = (url: string) => {
  const clean = String(url).split('/m/')[0];
  const parts = clean.split('/').filter(Boolean);
  const file = parts[parts.length - 1] || 'asset';
  const hash = parts[parts.length - 2] || '';
  const dims = /\/(\d+x\d+)\//.exec(clean) || [, ''];
  return [dims[1], hash ? hash.slice(0, 10) : '', file].filter(Boolean).join('-');
};
const naturalOf = (url: string) => {
  const m = /\/(\d+)x(\d+)\//.exec(String(url).split('/m/')[0]);
  return m ? { w: +m[1], h: +m[2] } : { w: null, h: null };
};

/**
 * The card's stacked layers, in the order the original builds them
 * (module 1959 `v` in `evidence/source-assets/js/app/work/page-8e3968f3d61178f4.js`):
 *
 *   v = thumbnail_video ? {video} : thumbnail ? {image}      // layer 0
 *   g = thumbnails_multimedia[] -> work_item_video | work_item_image
 *   x = thumbnails[]            -> image
 *   w = [v, ...g, ...x] truncated to (multimedia + thumbnails + 1)
 *
 * `FeaturedCard.layers` (captured from the live DOM, `opacity:1` then `opacity:0`)
 * is used as the cross-check: the kinds must agree, and they do for all 8 cards.
 */
export function cardLayers(card: FeaturedCard): CardLayer[] {
  const raw = (card.raw || {}) as {
    thumbnail_video?: string | null;
    thumbnails_multimedia?: { component?: string; source?: string; image?: { filename?: string; alt?: string } }[];
    thumbnails?: { filename?: string; alt?: string }[];
  };
  const out: CardLayer[] = [];

  if (raw.thumbnail_video) {
    out.push({ kind: 'video', source: raw.thumbnail_video, vimeoId: vimeoIdOf(raw.thumbnail_video) });
  } else if (card.image) {
    out.push({
      kind: 'image',
      src: `/sites/gladeye/work/${card.slug}/${card.image.local}`,
      alt: card.image.alt || 'Gladeye',
      naturalWidth: card.image.naturalWidth,
      naturalHeight: card.image.naturalHeight,
    });
  }

  for (const m of raw.thumbnails_multimedia || []) {
    if (m?.component === 'work_item_video' && m.source) {
      out.push({ kind: 'video', source: m.source, vimeoId: vimeoIdOf(m.source) });
    } else if (m?.component === 'work_item_image' && m.image?.filename) {
      const n = naturalOf(m.image.filename);
      out.push({
        kind: 'image',
        src: `/sites/gladeye/work/${card.slug}/${storyblokLocal(m.image.filename)}`,
        alt: m.image.alt || 'Gladeye',
        naturalWidth: n.w,
        naturalHeight: n.h,
      });
    }
  }
  for (const t of raw.thumbnails || []) {
    const filename = typeof t === 'string' ? t : t?.filename;
    if (!filename) continue;
    const n = naturalOf(filename);
    out.push({
      kind: 'image',
      src: `/sites/gladeye/work/${card.slug}/${storyblokLocal(filename)}`,
      alt: (t as { alt?: string })?.alt || 'Gladeye',
      naturalWidth: n.w,
      naturalHeight: n.h,
    });
  }

  const cap = (raw.thumbnails_multimedia || []).length + (raw.thumbnails || []).length + 1;
  return out.slice(0, cap);
}

export function vimeoIdOf(source: string): string | null {
  const m = /(?:vimeo\.com\/|playback\/)(\d+)/.exec(String(source || ''));
  return m ? m[1] : null;
}

const isDirectFile = (source: string) => /progressive_redirect|\.mp4/.test(String(source));

/**
 * Vimeo layer. The original mounts a react-player (`controls=0`, looped) and keeps it
 * mounted but hidden; an iframe costs a document per card, so this one mounts on
 * demand and unmounts when the layer is no longer the active one.
 */
function CardVideo({ layer, active }: { layer: { source: string; vimeoId: string | null }; active: boolean }) {
  if (isDirectFile(layer.source)) {
    return (
      <video
        className="h-full w-full object-cover"
        src={layer.source}
        muted
        loop
        playsInline
        autoPlay={active}
        preload="none"
        aria-hidden
      />
    );
  }
  if (!layer.vimeoId) return null;
  return (
    <div className="h-full w-full [&>iframe]:h-full [&>iframe]:w-full" style={{ aspectRatio: '1.7777777777777777' }}>
      {active ? (
        <iframe
          title="Gladeye showreel"
          src={`https://player.vimeo.com/video/${layer.vimeoId}?title=0&byline=0&portrait=0&controls=0&autopause=0&loop=1&background=1&autoplay=1&muted=1`}
          allow="autoplay; fullscreen; picture-in-picture"
          className="absolute inset-0 h-full w-full border-0"
        />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------- card -- */

function WorkGridCard({
  card,
  index,
  layers,
  cursorClass,
  onHoverChange,
  onClicked,
  registerReveal,
}: {
  card: FeaturedCard;
  index: number;
  layers: CardLayer[];
  cursorClass: string;
  onHoverChange: (hovering: boolean) => void;
  onClicked: () => void;
  registerReveal: (index: number, cropper: HTMLElement | null, frame: HTMLElement | null) => void;
}) {
  const [active, setActive] = useState(0);
  const [loaded, setLoaded] = useState<number[]>([]);
  const frameRef = useRef<HTMLDivElement | null>(null);

  /* module 1959: `y = multimedia.length + thumbnails.length + 1`, i.e. the layer count */
  const total = layers.length;

  const markLoaded = useCallback((i: number) => setLoaded((prev) => (prev.includes(i) ? prev : [...prev, i])), []);

  /**
   * Verbatim pointer model: the horizontal position inside the card picks which layer
   * is on top, and only layers that have finished loading are eligible.
   */
  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const i = Math.round((total - 2) * rel) + 1;
    setActive(Math.round(i % Math.max(1, loaded.length || 1)));
  };

  useEffect(() => {
    if (!loaded.length && layers.length) setActive(0);
  }, [loaded.length, layers.length]);

  const cropperRef = useCallback(
    (node: HTMLDivElement | null) => {
      registerReveal(index, node, node ? node.firstElementChild as HTMLDivElement : null);
    },
    [index, registerReveal],
  );

  return (
    <Link
      href={`/work/${card.slug}`}
      className={`FeaturedWorkGrid_item__hQBLy ${cursorClass}`.trim()}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => {
        onHoverChange(false);
        setActive(0);
      }}
      onClick={onClicked}
      scroll={false}
    >
      <div ref={cropperRef} className="FeaturedWorkGrid_item-cropper__eCJDn" style={{ transform: 'scale(0.8) translateZ(0)' }}>
        <div
          ref={frameRef}
          className="FeaturedWorkGrid_item-image__IiTMQ"
          style={{ opacity: 0, transform: 'scale(1.4) translateZ(0)' }}
        >
          <div className="relative h-full w-full" onMouseMove={onMouseMove}>
            {layers.map((layer, i) => (
              <div
                key={i}
                className="absolute bottom-0 left-0 right-0 top-0 z-10"
                style={{
                  opacity: active === i ? 1 : 0,
                  transitionProperty: 'opacity',
                  transitionDuration: '125ms',
                  transitionTimingFunction: 'cubic-bezier(0.165, 0.84, 0.44, 1)',
                }}
                aria-hidden={active !== i}
              >
                {layer.kind === 'image' ? (
                  <CardImage layer={layer} onLoaded={() => markLoaded(i)} priority={i === 0 && index < 2} />
                ) : (
                  <div className="pointer-events-none relative h-full w-full overflow-hidden">
                    <div className="absolute left-1/2 top-1/2 h-full min-w-full -translate-x-1/2 -translate-y-1/2">
                      <CardVideo layer={layer} active={active === i} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="FeaturedWorkGrid_item-content__cCe74">
        {card.client ? <h4 className="t-meta">{card.client}</h4> : null}
        {card.title ? (
          <h3 className="t-p-lg-alt">
            <MotionLink text={card.title} className="FeaturedWorkGrid_item-content-h3-inner__lgneM" />
          </h3>
        ) : null}
      </div>
    </Link>
  );
}

/** The original's `BlurImage`: a /m/20x0 layer under the real asset, both cover-fit. */
function CardImage({
  layer,
  onLoaded,
  priority,
}: {
  layer: Extract<CardLayer, { kind: 'image' }>;
  onLoaded: () => void;
  priority: boolean;
}) {
  const [ready, setReady] = useState(false);
  return (
    <div className="relative overflow-hidden h-full w-full">
      <img
        alt="Placeholder"
        aria-hidden
        decoding="async"
        className="blur-lg transition-all duration-750 ease-in-out"
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
        src={layer.src}
      />
      <img
        ref={(node) => {
          // Locally served images usually finish decoding before React attaches
          // onLoad, which left every featured cover stuck on the blurred layer.
          if (node && node.complete && node.naturalWidth > 0) {
            setReady(true);
            onLoaded();
          }
        }}
        alt={layer.alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => {
          setReady(true);
          onLoaded();
        }}
        onError={() => setReady(true)}
        className="transition-all duration-750 ease-in-out"
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
          opacity: ready ? 1 : 0,
        }}
        src={layer.src}
        sizes="(min-width: 768px) 65vw, 100vw"
        data-natural={layer.naturalWidth ? `${layer.naturalWidth}x${layer.naturalHeight ?? '?'}` : undefined}
      />
    </div>
  );
}

/* ------------------------------------------------------------------- grid --- */

/**
 * Port of module 1959 `FeaturedWorkGrid` (`F` + `WorkGridItem` + `ColoredDotCursor`)
 * from `evidence/source-assets/js/app/work/page-8e3968f3d61178f4.js`.
 *
 * Three behaviours, all read off the shipped bundle + the captured SSR DOM:
 *  1. scroll reveal — cropper `scale(0.8 -> 1)`, image `scale(1.4 -> 1)` + opacity,
 *     driven by `useScroll(offset:["start end","end end"])` through a spring
 *     (stiffness 200 / damping 30). Cards already on screen at mount skip it
 *     (`setInView(!rect.top <= innerHeight)`), which is why the SSR transform is only
 *     a starting pose.
 *  2. hover — the card stacks every thumbnail/multimedia layer and the pointer's X
 *     position inside the card cross-fades between them (125 ms).
 *  3. `+` custom cursor — a fixed, spring-followed disc; the item gets
 *     `cursor: none` while it is live, and the disc spins up on click.
 */
export function FeaturedWorkGrid({ cards }: { cards: FeaturedCard[] }) {
  const [hovering, setHovering] = useState(false);
  const [pointerLive, setPointerLive] = useState(false);
  const [clicked, setClicked] = useState(false);

  const cursorRef = useRef<HTMLDivElement | null>(null);
  const posX = useRef(new Spring(-50, { stiffness: 1000, damping: 100 }));
  const posY = useRef(new Spring(-50, { stiffness: 1000, damping: 100 }));
  const scale = useRef(new Spring(0, { stiffness: 1000, damping: 100 }));
  const stopCursor = useRef<null | (() => void)>(null);
  const reveal = useRef(
    new Map<number, { cropper: HTMLElement | null; frame: HTMLElement | null; spring: Spring; enabled: boolean }>(),
  );
  const stopReveal = useRef<null | (() => void)>(null);

  const fine = useMemo(() => canUseHover() && !prefersReducedMotion(), []);

  /* ---- pointer-following `+` disc (ColoredDotCursor, module 1959 `N`) ---- */
  useEffect(() => {
    if (!fine) return;
    const target = hovering ? 1 : 0;
    scale.current.set(target);
    const paint = () => {
      const el = cursorRef.current;
      if (!el) return;
      el.style.transform = `translate3d(${posX.current.value}px, ${posY.current.value}px, 0) scale(${scale.current.value}) translateZ(0)`;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        setPointerLive(false);
        return;
      }
      setPointerLive(true);
      posX.current.set(e.clientX);
      posY.current.set(e.clientY);
      wake();
    };
    const wake = () => {
      if (stopCursor.current) return;
      stopCursor.current = startTicker((dt) => {
        posX.current.step(dt);
        posY.current.step(dt);
        scale.current.step(dt);
        paint();
        if (posX.current.done && posY.current.done && scale.current.done) {
          stopCursor.current = null;
          return false;
        }
        return true;
      });
    };
    wake();
    window.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('pointermove', onMove);
      stopCursor.current?.();
      stopCursor.current = null;
    };
  }, [fine, hovering]);

  /* ---- scroll reveal, one ticker for the whole grid ---- */
  const registerReveal = useCallback((index: number, cropper: HTMLElement | null, frame: HTMLElement | null) => {
    const entry =
      reveal.current.get(index) ||
      { cropper: null, frame: null, spring: new Spring(0, { stiffness: 200, damping: 30 }), enabled: true };
    entry.cropper = cropper;
    entry.frame = frame;
    // module 1959 `S`: a card already on screen when it mounts does not play the zoom
    if (frame) entry.enabled = !(frame.getBoundingClientRect().top <= window.innerHeight);
    reveal.current.set(index, entry);
  }, []);

  useEffect(() => {
    const settle = () => {
      reveal.current.forEach((r) => {
        if (r.cropper) r.cropper.style.transform = 'scale(1) translateZ(0)';
        if (r.frame) {
          r.frame.style.transform = 'scale(1) translateZ(0)';
          r.frame.style.opacity = '1';
        }
      });
    };
    if (!fine) {
      settle();
      return;
    }
    const tick = (dt: number) => {
      let moving = false;
      reveal.current.forEach((r) => {
        if (!r.frame || !r.cropper) return;
        r.spring.set(scrollProgress(r.frame));
        const p = r.spring.step(dt);
        if (!r.spring.done) moving = true;
        if (r.enabled) {
          // useTransform(C, [0,1], [0.8,1]) / ([1.4,1]) — clamped like the original
          const cropperScale = 0.8 + 0.2 * Math.max(0, Math.min(1, p));
          const frameScale = 1.4 - 0.4 * Math.max(0, Math.min(1, p));
          r.cropper.style.transform = `scale(${cropperScale}) translateZ(0)`;
          r.frame.style.transform = `scale(${frameScale}) translateZ(0)`;
          r.frame.style.opacity = String(Math.max(0, Math.min(1, p * 4)));
        } else {
          r.cropper.style.transform = 'scale(1) translateZ(0)';
          r.frame.style.transform = 'scale(1) translateZ(0)';
          r.frame.style.opacity = '1';
        }
      });
      return moving;
    };
    const wake = () => {
      // startTicker self-terminates once no spring is moving, but the stop
      // handle it returned stays truthy — so a plain `if (!stopReveal.current)`
      // guard could never restart the loop and every card that was below the
      // fold at mount stayed at opacity 0 forever. Clear the handle when the
      // ticker ends on its own so a later scroll can wake it.
      if (stopReveal.current) return;
      const stop = startTicker((dt) => {
        const keepGoing = tick(dt);
        if (keepGoing === false) stopReveal.current = null;
        return keepGoing;
      });
      stopReveal.current = stop;
    };
    window.addEventListener('scroll', wake, { passive: true });
    window.addEventListener('resize', wake);
    wake();
    return () => {
      stopReveal.current?.();
      stopReveal.current = null;
      window.removeEventListener('scroll', wake);
      window.removeEventListener('resize', wake);
    };
  }, [fine]);

  const layersByCard = useMemo(() => cards.map(cardLayers), [cards]);

  return (
    <div className="FeaturedWorkGrid_items__xex6n">
      {cards.map((card, i) => (
        <WorkGridCard
          key={card.slug}
          card={card}
          index={i}
          layers={layersByCard[i]}
          cursorClass={pointerLive && fine ? 'FeaturedWorkGrid_custom-cursor-enabled__NujhB' : ''}
          onHoverChange={setHovering}
          onClicked={() => setClicked(true)}
          registerReveal={registerReveal}
        />
      ))}

      <div
        ref={cursorRef}
        className="ColoredDotCursor_custom-cursor__QMy_f FeaturedWorkGrid_custom-cursor__RLOR7"
        style={{
          opacity: hovering && pointerLive && fine ? 1 : 0,
          transform: 'translateX(0px) translateY(0px) scale(0) translateZ(0)',
          transition: 'opacity .25s cubic-bezier(0.165, 0.84, 0.44, 1)',
        }}
        aria-hidden
      >
        <div className={`FeaturedWorkGrid_plus-icon__ThXFs ${clicked ? 'FeaturedWorkGrid_plus-icon--clicked__1zIDv' : ''}`}>
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

export default FeaturedWorkGrid;
