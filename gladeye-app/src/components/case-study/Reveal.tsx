'use client';

import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';

/**
 * The original pages SSR every heading / media wrapper with
 * `style="opacity:0;transform:translateY(0.5em) translateZ(0)"` and animate it in when it
 * enters the viewport. No framer-motion is installed in this project, so the same visual
 * contract is implemented with IntersectionObserver + the site's own easing
 * (cubic-bezier(.165,.84,.44,1), 0.5s — verbatim from the published CSS).
 */
export default function Reveal({
  as: Tag = 'div',
  className = '',
  style,
  children,
  offsetY = '0.5em',
  duration = 600,
  once = true,
}: {
  as?: ElementType;
  className?: string;
  style?: React.CSSProperties;
  children?: ReactNode;
  offsetY?: string | null;
  duration?: number;
  once?: boolean;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(true);
      return;
    }

    // Several hero wrappers contain only absolutely-positioned media, so the
    // wrapper itself collapses to a 0x0 box. IntersectionObserver can never
    // report an intersection for a target with no area, which left those
    // sections permanently at opacity:0. Observe the first descendant that
    // actually has a box instead.
    const area = (node: Element) => {
      const r = node.getBoundingClientRect();
      return r.width * r.height;
    };
    let target: Element = el;
    if (area(el) === 0) {
      const sized = Array.from(el.querySelectorAll('*')).find((n) => area(n) > 0);
      if (sized) target = sized;
    }

    // A target with no box cannot be observed at all (IntersectionObserver
    // never reports an intersection for zero area), so it must not be gated on
    // the observer or it stays hidden forever.
    if (area(target) === 0) {
      setShown(true);
      return;
    }

    // Anything already on screen at mount must show without waiting for a
    // scroll event: the -10% bottom inset below is tuned for elements entering
    // from the bottom edge and would otherwise exclude content that is already
    // visible but sits in that last band.
    const rect = target.getBoundingClientRect();
    if (rect.top <= window.innerHeight && rect.bottom >= 0) {
      setShown(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            setShown(true);
            if (once) io.disconnect();
          } else if (!once) setShown(false);
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.01 },
    );
    io.observe(target);
    return () => io.disconnect();
  }, [once]);

  const hidden: React.CSSProperties = offsetY ? { opacity: 0, transform: `translateY(${offsetY}) translateZ(0)` } : { opacity: 0 };

  return (
    <Tag
      ref={ref as never}
      className={`gl-reveal ${className}`.trim()}
      style={{
        ...style,
        transitionDuration: `${duration}ms`,
        ...(shown ? { opacity: 1, transform: 'none' } : hidden),
      }}
    >
      {children}
    </Tag>
  );
}
