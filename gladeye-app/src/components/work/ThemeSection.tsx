'use client';

import { useEffect, useRef } from 'react';

import { useTheme } from '@/lib/theme';

import type { CSSProperties, ReactNode } from 'react';
import type { ThemeName } from '@/lib/theme';

/**
 * Verbatim port of webpack module 1554 (`Section`) from
 * `evidence/source-assets/js/app/work/page-8e3968f3d61178f4.js`:
 *
 *   const {setPageTheme, setHeaderTheme} = useTheme();
 *   const io = useInViewCallback(([{isIntersecting}]) => {
 *     if (isIntersecting) { setPageTheme(theme); setHeaderTheme(theme); onVisible?.(); }
 *   }, { rootMargin: '-50% 0% -50% 0%', threshold: [0] });
 *   return <section data-theme={theme} className="text-theme-secondary
 *            transition-colors duration-theme" ref={io}>{children}</section>
 *
 * A strip exactly one pixel tall across the middle of the viewport decides which
 * section owns the page + header theme, which is why gladeye.com's header inverts
 * as you scroll through sections of different themes. The `data-theme` attribute is
 * what actually paints the section (see `[data-theme='…']` in src/styles/tokens.css);
 * the context call is what repaints the fixed header above it.
 */
export function ThemeSection({
  theme,
  children,
  className = '',
  style,
  onVisible,
}: {
  theme: ThemeName;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  onVisible?: () => void;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const { setPageTheme, setHeaderTheme } = useTheme();
  const visible = useRef(onVisible);
  visible.current = onVisible;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry.isIntersecting) return;
        setPageTheme(theme);
        setHeaderTheme(theme);
        visible.current?.();
      },
      { rootMargin: '-50% 0% -50% 0%', threshold: [0] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [theme, setPageTheme, setHeaderTheme]);

  return (
    <section
      ref={ref}
      data-theme={theme}
      className={`text-theme-secondary transition-colors duration-theme ${className}`.trim()}
      style={style}
    >
      {children}
    </section>
  );
}

export default ThemeSection;
