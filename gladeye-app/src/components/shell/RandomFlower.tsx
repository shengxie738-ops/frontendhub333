"use client";

import { FlowerMark } from "@/components/shared/icons";

/**
 * Port of webpack module 5299's `X` component ("RandomFlower").
 *
 * In the original, `X` picks a random member of the seven-flower pool `$`
 * inside `useLayoutEffect` and cross-fades it through an `AnimatePresence`
 * (`mode="wait"`, `initial/animate/exit: {opacity}` with `.25s`). That is why the
 * server-rendered home page capture has an EMPTY `<a aria-label="About">` while
 * the about-page capture contains a flower.
 *
 * The captured, settled DOM (EVIDENCE §10) shows pool index `0` — the compact
 * `viewBox="0 0 50 43.49"` bloom — so that is the artwork this component inlines
 * (verbatim path, `evidence/content` pool index 0). The 90s rotation and the
 * `.25s` fade-in are the original values.
 */
export function RandomFlower({ className }: { className?: string }) {
  return (
    <FlowerMark
      aria-hidden="true"
      focusable="false"
      className={[
        className,
        "RandomFlower_svg__Fz3ul",
        "h-auto w-full",
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}

/**
 * The wrapper the header actually renders (`<div class="w-[50px] fill-current"
 * style="opacity: 1">`) — the inline opacity is Framer Motion's `animate` value
 * landing at 1 after the `.25s` fade.
 */
export function RandomFlowerSlot() {
  return (
    <div className="w-[50px] fill-current" style={{ opacity: 1 }}>
      <RandomFlower />
    </div>
  );
}
