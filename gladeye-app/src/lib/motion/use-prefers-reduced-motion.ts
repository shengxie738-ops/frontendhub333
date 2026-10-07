"use client";

import { useEffect, useState } from "react";

/**
 * `prefers-reduced-motion` as a reactive boolean.
 *
 * The original site only honours it implicitly (its largest motions are Framer
 * Motion timelines that keep running); here every shell animation consults this
 * hook or the matching CSS media query so that navigation and content stay
 * complete while the large-scale motion is disabled.
 */
const QUERY = "(prefers-reduced-motion: reduce)";

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(QUERY).matches;
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(QUERY);
    const sync = () => setReduced(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  return reduced;
}
