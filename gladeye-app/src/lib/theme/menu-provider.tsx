"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { ReactNode, RefObject } from "react";

/**
 * Owns the MenuOverlay open/closed flag so that the header button, the overlay
 * itself and any in-page CTA ("Explore our work" → menu, route links → close)
 * share one source of truth, and so focus can be handed back to the exact
 * element that opened the panel.
 *
 * In the original this state is local to the Header component
 * (`module 5299`: `let [r,s]=useState(false)`); it is lifted here because the
 * footer and case-study CTAs need it too.
 */
export interface MenuContextValue {
  open: boolean;
  openMenu: () => void;
  closeMenu: () => void;
  toggleMenu: () => void;
  /** Element to receive focus when the panel closes (the Menu button). */
  triggerRef: RefObject<HTMLElement | null>;
  setTrigger: (element: HTMLElement | null) => void;
}

const MenuContext = createContext<MenuContextValue | null>(null);

export function MenuProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);

  const setTrigger = useCallback((element: HTMLElement | null) => {
    triggerRef.current = element;
  }, []);

  const openMenu = useCallback(() => setOpen(true), []);
  const closeMenu = useCallback(() => setOpen(false), []);
  const toggleMenu = useCallback(() => setOpen((value) => !value), []);

  const value = useMemo<MenuContextValue>(
    () => ({ open, openMenu, closeMenu, toggleMenu, triggerRef, setTrigger }),
    [open, openMenu, closeMenu, toggleMenu, setTrigger],
  );

  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}

export function useMenu(): MenuContextValue {
  const context = useContext(MenuContext);
  if (!context) throw new Error("Cannot find menu context");
  return context;
}

/**
 * Escape-to-close, mounted once by the overlay.
 * module 5299 `T(open, close)` — verbatim behaviour: a document-level keydown
 * listener that only reacts to `Escape` while `open` is true.
 */
export function useEscapeToClose(active: boolean, onEscape: () => void): void {
  useEffect(() => {
    if (!active) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onEscape();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [active, onEscape]);
}

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Keeps Tab focus inside `containerRef` while `active`, and restores focus to
 * `restoreRef` when it deactivates.
 */
export function useFocusTrap(
  active: boolean,
  containerRef: RefObject<HTMLElement | null>,
  restoreRef?: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusFirst = () => {
      const target = container.querySelector<HTMLElement>(FOCUSABLE);
      (target ?? container).focus({ preventScroll: true });
    };
    const raf = window.requestAnimationFrame(focusFirst);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const nodes = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (node) => node.offsetParent !== null || node === document.activeElement,
      );
      if (nodes.length === 0) {
        event.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active$ = document.activeElement;
      if (event.shiftKey && (active$ === first || !container.contains(active$))) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && (active$ === last || !container.contains(active$))) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKeyDown, true);
      const restore = restoreRef?.current ?? previouslyFocused;
      if (restore && restore.isConnected) restore.focus({ preventScroll: true });
    };
  }, [active, containerRef, restoreRef]);
}
