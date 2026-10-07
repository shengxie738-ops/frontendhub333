'use client';

import { useEffect, useState } from 'react';

import { useTheme } from '@/lib/theme';

import type { ReactNode } from 'react';
import type { ThemeName } from '@/lib/theme';

/**
 * The page background wrapper, verbatim from EVIDENCE §10 / every captured page:
 *
 *   <main style="--theme-primary:…;--theme-secondary:…;--theme-tertiary:…" class="bg-black">
 *     <div style="opacity:1">
 *       <div class="relative z-main bg-theme-primary transition-bg duration-theme">
 *
 * On the original, `<main>` carries the theme variables that `ThemeProvider` resolves
 * from the route/section, so the wrapper repaints (over 0.5 s) as sections of different
 * themes scroll past. This project's root layout owns `<main>`, so the wrapper mirrors
 * the live `pageTheme` here instead: the first paint uses the route's own theme (no
 * flash), and every later change comes from `ThemeSection`'s IntersectionObserver.
 */
export function ThemeShell({ initialTheme, children }: { initialTheme: ThemeName; children?: ReactNode }) {
  const { pageTheme } = useTheme();
  const [theme, setTheme] = useState<ThemeName>(initialTheme);

  useEffect(() => {
    setTheme(pageTheme);
  }, [pageTheme]);

  return (
    <div data-theme={theme} className="relative z-main bg-theme-primary transition-bg duration-theme">
      {children}
    </div>
  );
}

export default ThemeShell;
