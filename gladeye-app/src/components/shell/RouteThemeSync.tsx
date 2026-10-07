"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { pageThemeForPath, useMenu, useTheme } from "@/lib/theme";

import type { ThemeName } from "@/lib/theme";

/**
 * The fixed header lives outside each route's `data-theme` section, so it can
 * only pick up the right colours once the theme context is told which page is
 * showing. Without this the header stays on DEFAULT_THEME and renders a white
 * wordmark/flower over the yellow /contact page.
 *
 * While the menu is open the original forces the `green` header theme
 * (module 5299: `u = open ? "green" : headerTheme`), which SiteHeader applies
 * itself — so this effect only tracks the route.
 */
export function RouteThemeSync() {
  const pathname = usePathname();
  const { setPageTheme, setHeaderTheme } = useTheme();
  const { open } = useMenu();
  const pendingHeaderTheme = useRef<ThemeName | null>(null);

  useEffect(() => {
    const theme = pageThemeForPath(pathname);
    setPageTheme(theme);
    pendingHeaderTheme.current = theme;
  }, [pathname, setPageTheme]);

  useEffect(() => {
    // Only a new route owns this update. A same-route menu close must leave
    // section themes and the overlay's delayed theme restoration intact.
    if (open || pendingHeaderTheme.current === null) return;
    setHeaderTheme(pendingHeaderTheme.current);
    pendingHeaderTheme.current = null;
  }, [pathname, open, setHeaderTheme]);

  return null;
}
