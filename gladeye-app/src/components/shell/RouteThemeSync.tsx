"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { pageThemeForPath, useMenu, useTheme } from "@/lib/theme";

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

  useEffect(() => {
    const theme = pageThemeForPath(pathname);
    setPageTheme(theme);
    if (!open) setHeaderTheme(theme);
  }, [pathname, open, setPageTheme, setHeaderTheme]);

  return null;
}
