"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import type { ReactNode } from "react";

import {
  DEFAULT_THEME,
  MENU_THEME,
  resolveTheme,
  type HeaderThemeVars,
  type MenuThemeVars,
  type PageThemeVars,
  type ThemeName,
} from "./themes";

/**
 * Port of webpack module 7472 (`ThemeProvider` / `useTheme`) from
 * `evidence/source-assets/js/131-8efcfd03f067c029.js`.
 *
 * Three independent slots, exactly like the original:
 *   pageTheme   — the `<main>` inline vars, driven by the active route
 *   menuTheme   — the overlay vars (always `green` while the menu is open)
 *   headerTheme — the header vars; the header may sit over a light section
 *                 while the page itself is dark (see the footer IntersectionObserver
 *                 in module 9858, which calls `setHeaderTheme('light')`)
 */

export interface ThemeContextValue {
  pageTheme: ThemeName;
  setPageTheme: (theme: ThemeName) => void;
  menuTheme: ThemeName;
  setMenuTheme: (theme: ThemeName) => void;
  headerTheme: ThemeName;
  setHeaderTheme: (theme: ThemeName) => void;
  /** Resolved inline-style objects for the current theme slots. */
  pageThemeVars: PageThemeVars;
  menuThemeVars: MenuThemeVars;
  headerThemeVars: HeaderThemeVars;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  initialPageTheme = DEFAULT_THEME,
  initialHeaderTheme = initialPageTheme,
}: {
  children: ReactNode;
  initialPageTheme?: ThemeName;
  initialHeaderTheme?: ThemeName;
}) {
  const [pageTheme, setPageThemeState] = useState<ThemeName>(initialPageTheme);
  const [menuTheme, setMenuThemeState] = useState<ThemeName>(MENU_THEME);
  const [headerTheme, setHeaderThemeState] = useState<ThemeName>(initialHeaderTheme);

  const setPageTheme = useCallback((theme: ThemeName) => setPageThemeState(theme), []);
  const setMenuTheme = useCallback((theme: ThemeName) => setMenuThemeState(theme), []);
  const setHeaderTheme = useCallback((theme: ThemeName) => setHeaderThemeState(theme), []);

  const value = useMemo<ThemeContextValue>(() => {
    const resolved = resolveTheme(pageTheme);
    const menu = resolveTheme(menuTheme);
    const header = resolveTheme(headerTheme);
    return {
      pageTheme,
      setPageTheme,
      menuTheme,
      setMenuTheme,
      headerTheme,
      setHeaderTheme,
      pageThemeVars: resolved.pageTheme,
      menuThemeVars: menu.menuTheme,
      headerThemeVars: header.headerTheme,
    };
  }, [pageTheme, menuTheme, headerTheme, setPageTheme, setMenuTheme, setHeaderTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** module 7472 `useTheme()` — throws outside a provider, just like the original. */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("Cannot find theme context");
  return context;
}

/**
 * The header renders `{...pageThemeVars, ...headerThemeVars}` (module 5299:
 * `let h = {...m, ...d}`), so page tokens are visible to header children too.
 */
export function mergeHeaderStyle(
  page: PageThemeVars,
  header: HeaderThemeVars,
): PageThemeVars & HeaderThemeVars {
  return { ...page, ...header };
}

export { DEFAULT_THEME, MENU_THEME };
