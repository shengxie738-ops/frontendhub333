"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { FooterContact } from "@/components/shell/SiteFooter";
import {
  MENU_THEME,
  SITE_MENU,
  acquireScrollLock,
  isMenuEntrySelected,
  releaseScrollLock,
  useEscapeToClose,
  useFocusTrap,
  useMenu,
  useTheme,
} from "@/lib/theme";

import type { CSSProperties } from "react";
import type { MenuItem, ThemeName } from "@/lib/theme";

/**
 * Port of the `z` / `q` / `F` components in webpack module 5299
 * (`evidence/source-assets/js/app/layout-3ab4cf37f3ac757c.js`).
 *
 * Structure, verbatim (EVIDENCE §10 + module 5299):
 *   <nav class="fixed inset-0 z-Menu">
 *     <div style="{menu theme vars}"
 *          class="h-screen overflow-y-auto overflow-x-hidden text-theme-secondary
 *                 transition-colors duration-theme">
 *       <div class="absolute inset-0 z-[-1] origin-top bg-theme-primary
 *                   transition-colors duration-theme" />   ← scaleY wipe
 *       <div class="flex min-h-screen flex-col">
 *         <div class="flex flex-1 items-center justify-center px-sms pb-12
 *                     pt-Header-height md:py-Header-height">
 *           <ul class="Menu_main__iLoQn">…</ul>
 *         </div>
 *         <div class="px-sms pb-12 md:pb-0">…contact meta…</div>
 *       </div>
 *     </div>
 *   </nav>
 *
 * The original drives enter/exit with Framer Motion variants; framer-motion is
 * not a dependency here, so the identical numbers are expressed as CSS
 * transitions in `src/styles/components.css` (`.Menu_backdrop`,
 * `.Menu_staggerItem`, `.Menu_meta`). CSS transitions are the better fit anyway:
 * they retarget from the current value, so hammering the Menu button interrupts
 * cleanly instead of queueing a competing timeline.
 */

/** Longest exit path: item .225s + reversed stagger, rounded up to the theme-swap lag. */
const EXIT_MS = 450;
const SCROLL_LOCK_OWNER = "gladeye:menu";

interface StaggerStyle extends CSSProperties {
  "--menu-index": string;
  "--menu-count": string;
}

export function MenuOverlay() {
  const { open, closeMenu, triggerRef } = useMenu();
  const {
    headerTheme,
    pageThemeVars,
    menuThemeVars,
    setMenuTheme,
    setHeaderTheme,
  } = useTheme();
  const [mounted, setMounted] = useState(open);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousHeaderTheme = useRef<ThemeName | null>(null);
  const wasOpen = useRef(false);
  const pathname = usePathname();

  /* keep the panel mounted through the exit transition ------------------- */
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    if (!wasOpen.current) return;
    const timer = window.setTimeout(() => setMounted(false), EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  /* theme swap: menu + header go `green`, header restores 450ms later ---- */
  useEffect(() => {
    if (open && !wasOpen.current) {
      previousHeaderTheme.current = headerTheme;
      setMenuTheme(MENU_THEME);
      setHeaderTheme(MENU_THEME);
    }
    if (!open && wasOpen.current) {
      window.setTimeout(() => {
        setMenuTheme(MENU_THEME);
        const restore = previousHeaderTheme.current;
        if (restore) setHeaderTheme(restore);
        previousHeaderTheme.current = null;
      }, EXIT_MS);
    }
    wasOpen.current = open;
  }, [open, headerTheme, setMenuTheme, setHeaderTheme]);

  /* page scroll freeze on the panel (module 5299 disablePageScroll(el)) -- */
  /* `mounted` is a dependency because the panel only exists from the render
     AFTER `open` flips: reading panelRef in an [open]-only effect always saw
     null and silently skipped both the lock and the focus trap. */
  useEffect(() => {
    if (!mounted) return;
    const panel = panelRef.current;
    if (!panel) return;
    if (open) acquireScrollLock(SCROLL_LOCK_OWNER, { target: panel });
    else releaseScrollLock(SCROLL_LOCK_OWNER);
  }, [open, mounted]);

  useEffect(() => {
    // Safety net: unmounting while still open must not leak the lock.
    return () => releaseScrollLock(SCROLL_LOCK_OWNER);
  }, []);

  useEscapeToClose(open, closeMenu);
  useFocusTrap(open && mounted, panelRef, triggerRef);

  const handleNavigate = useCallback(() => {
    closeMenu();
  }, [closeMenu]);

  if (!mounted) return null;

  const count = String(SITE_MENU.length);

  return (
    <nav
      aria-label="Main"
      id="site-menu"
      data-menu-open={open ? "true" : "false"}
      className="fixed inset-0 z-Menu"
    >
      <div
        ref={panelRef}
        style={{ ...pageThemeVars, ...menuThemeVars } as CSSProperties}
        className="h-screen overflow-y-auto overflow-x-hidden text-theme-secondary transition-colors duration-theme"
        tabIndex={-1}
      >
        <div className="Menu_backdrop absolute inset-0 z-[-1] origin-top bg-theme-primary transition-colors duration-theme" />

        <div className="flex min-h-screen flex-col">
          <div className="flex flex-1 items-center justify-center px-sms pb-12 pt-Header-height md:py-Header-height">
            <ul className="Menu_main__iLoQn">
              {SITE_MENU.map((item, index) => (
                <li
                  key={item.uid}
                  className="Menu_staggerItem relative"
                  style={
                    {
                      "--menu-index": String(index),
                      "--menu-count": count,
                    } as StaggerStyle
                  }
                >
                  <MenuItemLink item={item} onNavigate={handleNavigate} pathname={pathname} />
                </li>
              ))}
            </ul>
          </div>

          <div className="Menu_meta px-sms pb-12 md:pb-0">
            <FooterContact
              className="t-menu-meta text-center md:t-footer-meta footerLarge:flex footerLarge:text-left"
              animate={false}
              isHorizontal
            />
          </div>
        </div>
      </div>
    </nav>
  );
}

/**
 * module 5299 `F` — a plain (non-Motion) `Link` carrying `Menu_item__fjHgD`,
 * whose single child span flips to `font-serif italic` once the client-side
 * pathname comparison resolves. Epicene ships a real italic face, so this is a
 * genuine italic and not a synthetic oblique.
 */
function MenuItemLink({
  item,
  onNavigate,
  pathname,
}: {
  item: MenuItem;
  onNavigate: () => void;
  pathname: string;
}) {
  const selected = isMenuEntrySelected(pathname, item.cachedUrl);

  return (
    <Link
      href={item.href}
      className="Menu_item__fjHgD"
      onClick={onNavigate}
      aria-current={selected ? "page" : undefined}
    >
      <span className={selected ? "font-serif italic" : "font-sans"}>{item.label}</span>
    </Link>
  );
}
