"use client";

import Link from "next/link";

import { LogoWordmark } from "@/components/shared/icons";
import { Button } from "@/components/shell/Button";
import { MenuOverlay } from "@/components/shell/MenuOverlay";
import { RandomFlowerSlot } from "@/components/shell/RandomFlower";
import { MENU_THEME, useMenu, useTheme } from "@/lib/theme";

import type { CSSProperties } from "react";

/**
 * Port of the `ee` default export of webpack module 5299
 * (`evidence/source-assets/js/app/layout-3ab4cf37f3ac757c.js`), cross-checked
 * against EVIDENCE §10 and the `links` arrays in `evidence/content/*.json`.
 *
 * Verbatim structure:
 *   <div class="{theme} pointer-events-none fixed inset-x-0 z-20 z-Header
 *                text-theme-header transition-colors duration-theme"
 *        style="{...pageThemeVars, ...headerThemeVars}">
 *     <div class="flex h-Header-height items-center justify-between px-sms">
 *       <div class="w-[98px] sm:w-[130px]">            ← wordmark → /
 *       <div class="flex justify-center Header_buttonContainer__rN6i5">
 *                                                    ← Menu / Close toggle
 *       <div class="hidden w-[130px] justify-end md:flex"> ← flower → /about
 *
 * The wrapper is `pointer-events-none` so it never blocks the WebGL canvas
 * beneath it; each interactive child opts back in with `pointer-events-auto`.
 * The first class token is the live theme NAME (module 5299: `u = open ? "green"
 * : headerTheme`), which is how the original exposes the current header theme to
 * CSS and to the DOM.
 */
export function SiteHeader() {
  const { open, toggleMenu, setTrigger } = useMenu();
  const { headerTheme, pageThemeVars, headerThemeVars } = useTheme();

  const wrapperTheme = open ? MENU_THEME : headerTheme;

  const style = { ...pageThemeVars, ...headerThemeVars } as CSSProperties;

  return (
    <>
      <div
        className={`${wrapperTheme} pointer-events-none fixed inset-x-0 top-0 z-20 z-Header text-theme-header transition-colors duration-theme`}
        style={style}
      >
        <div className="flex h-Header-height items-center justify-between px-sms">
          <div className="w-[98px] sm:w-[130px]">
            <Link className="pointer-events-auto" aria-label="Home" href="/" scroll={false}>
              <LogoWordmark className="h-auto w-full fill-current" />
            </Link>
          </div>

          <div className="Header_buttonContainer__rN6i5 flex justify-center">
            <Button
              size="default"
              icon={false}
              filled={false}
              className={`Header_button__qn2Wj pointer-events-auto`}
              onClick={toggleMenu}
              elementRef={setTrigger}
              ariaLabel={open ? "Close menu" : "Open menu"}
              ariaExpanded={open}
              ariaControls="site-menu"
            >
              <span ref={undefined}>{open ? "Close" : "Menu"}</span>
            </Button>
          </div>

          <div className="hidden w-[130px] justify-end md:flex">
            <Link className="pointer-events-auto" aria-label="About" href="/about" scroll={false}>
              <RandomFlowerSlot />
            </Link>
          </div>
        </div>
      </div>

      <MenuOverlay />
    </>
  );
}
