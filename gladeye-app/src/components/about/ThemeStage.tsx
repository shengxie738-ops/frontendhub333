'use client';

import { useEffect, useRef, useState } from 'react';

import type { ReactNode } from 'react';

/**
 * The page-level theme container of `/about`.
 *
 * WHY THIS EXISTS
 *   `/about` is not one theme. Its five sections ship as
 *     green (hero) → green (Who we are) → green (Our services)
 *     → black (Our process) → black (Awards) → green (Join the family)
 *   and each `<section>` carries its own `data-theme` — that part is static
 *   markup and `AboutPage` renders it verbatim. But the colour that actually
 *   PAINTS is not on the sections: the frozen DOM paints
 *     `<div class="relative z-main bg-theme-primary transition-bg duration-theme">`
 *   i.e. the one container above them, and the original repaints that container
 *   from JS as you scroll (webpack module 1554, mirrored by
 *   `src/components/work/ThemeSection.tsx`: an IntersectionObserver with
 *   `rootMargin: '-50% 0% -50% 0%'` — a one-pixel band across the middle of the
 *   viewport — decides which section owns the page theme).
 *
 *   With a static `data-theme="green"` on the container, every section of the
 *   clone painted green and the two black sections lost their background
 *   (`docs/design-references/gladeye/about__50pct.png` / `__75pct.png` are black
 *   behind "Awards"). This component is that observer, scoped to the route, so
 *   the container repaints exactly where the original does.
 *
 *   It is deliberately local state rather than `useTheme()`: the shell owns the
 *   header theme and already syncs it per route (`shell/RouteThemeSync.tsx`),
 *   and the page background is this route's own business. No DOM class was added
 *   or removed to get here — only the container's `data-theme` value changes,
 *   which is what the shipped `[data-theme='…']` token block is for.
 *
 * The `transition-bg duration-theme` pair on the container is the shipped one,
 * so the repaint cross-fades the way the original does.
 */
export function ThemeStage({
  initialTheme,
  className = '',
  children,
}: {
  initialTheme: string;
  className?: string;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const sections = Array.from(root.querySelectorAll<HTMLElement>('section[data-theme]'));
    if (sections.length === 0) return;

    const pick = () => {
      const mid = window.innerHeight / 2;
      for (const s of sections) {
        const r = s.getBoundingClientRect();
        if (r.top <= mid && r.bottom > mid) {
          const next = s.dataset.theme;
          if (next) {
            setTheme(next);
            return;
          }
        }
      }
    };

    pick();
    // The band fires whenever a section edge crosses the viewport middle, which
    // is precisely when `pick()` can change its answer.
    const io = new IntersectionObserver(pick, {
      rootMargin: '-50% 0px -50% 0px',
      threshold: [0],
    });
    sections.forEach((s) => io.observe(s));
    window.addEventListener('resize', pick);
    return () => {
      io.disconnect();
      window.removeEventListener('resize', pick);
    };
  }, []);

  return (
    <div ref={rootRef} data-theme={theme} className={className}>
      {children}
    </div>
  );
}
