import type { SVGProps } from "react";

/**
 * Original vector artwork, inlined verbatim from `evidence/content/_.svgs.json`
 * (the asset-less "root" capture) and from the React factories embedded in
 * `evidence/source-assets/js/app/layout-3ab4cf37f3ac757c.js`.
 *
 * `viewBox` and every `d` attribute are untouched. The Gladeye wordmark is
 * lettering converted to outlines — re-typesetting it in a system font is not
 * acceptable, which is why it lives here as path data.
 */

/**
 * The "GLADEYE" wordmark lockup — `viewBox="0 0 2401 590"`, single outlined path.
 * Rendered at `class="h-auto w-full fill-current"` inside a `w-[98px] sm:w-[130px]`
 * slot (EVIDENCE §10).
 */
export function LogoWordmark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 2401 590" {...props}>
      <path d="M577.79 473.96h-86.85V.2h86.85v473.76Zm315.55-34.35c-13.61 16.85-47.96 40.18-103.69 40.18-105.64 0-177.58-71.94-177.58-179.52S683.36 121.4 789.65 121.4c42.77 0 82.31 15.55 102.4 38.24v-32.4h82.31v346.72h-81.01v-34.35Zm-98.51-36.94c58.33 0 95.27-43.42 95.27-102.4s-39.53-101.75-95.27-101.75c-58.98 0-95.92 44.07-95.92 101.75s38.89 102.4 95.92 102.4Zm495.34 36.94c-20.74 22.04-58.33 40.18-102.4 40.18-107.58 0-178.87-73.88-178.87-178.23s71.29-180.17 175.63-180.17c44.07 0 78.42 14.26 99.81 33.7V.2h86.84v473.76h-81.01v-34.35Zm-98.51-37.59c58.33 0 95.27-44.07 95.27-101.75s-38.24-101.75-95.27-101.75-95.92 44.07-95.92 101.75 39.54 101.75 95.92 101.75Zm304.73-73.23c4.54 46.01 36.94 73.88 86.2 73.88 44.07 0 69.34-23.33 87.49-51.85l64.16 38.89c-20.74 43.42-67.4 90.08-151.65 90.08-104.99 0-177.58-68.05-177.58-178.23 0-103.7 69.99-180.17 170.45-180.17s169.8 68.05 169.8 171.75c0 8.43 0 20.74-1.3 35.65h-247.57Zm1.95-65.46h156.83c-3.88-38.89-33.05-68.7-80.36-68.7-44.07 0-71.94 29.16-76.47 68.7Zm316.79 324.02 46.66-127.03-132.21-333.12h95.92l81.01 215.17 78.42-215.17h89.44l-174.99 460.15h-84.25Zm336.41-258.56c4.54 46.01 36.94 73.88 86.2 73.88 44.07 0 69.34-23.33 87.49-51.85l64.16 38.89c-20.74 43.42-67.4 90.08-151.65 90.08-104.99 0-177.58-68.05-177.58-178.23 0-103.7 69.99-180.17 170.45-180.17s169.8 68.05 169.8 171.75c0 8.43 0 20.74-1.3 35.65h-247.57Zm1.95-65.46h156.83c-3.88-38.89-33.05-68.7-80.36-68.7-44.07 0-71.94 29.16-76.47 68.7Zm-1798.2-34.75H243.77v84.75H352.8v35.82l-10.84 10.07c-18.8 19.44-55.09 39.53-106.94 39.53-81.01 0-140.64-58.98-140.64-149.71s55.74-148.41 136.75-148.41c59.62 0 93.33 29.16 114.06 57.03l69.99-51.85c-31.11-47.96-89.44-88.79-184.06-88.79C92.44 17.05.41 121.39.41 249.07c0 139.34 93.97 232.67 230.72 232.67 24.9 0 46.59-3.69 64.99-9.65.05 0 .1-.02.15-.05 2.59-.85 5.16-1.72 7.63-2.67 15.15-5.71 27.79-12.99 37.91-20.89.23-.17 5.29-4.11 10.99-8.52v33.98h84.75V310.82c0-45.37-36.89-82.26-82.26-82.26v.02Z" />
    </svg>
  );
}

/**
 * The header mark (`$[0]` of the `RandomFlower` pool in module 5299) —
 * `viewBox="0 0 50 43.49"`, the six-petal isometric bloom. EVIDENCE §10 shows it
 * rendered as `class="RandomFlower_svg__Fz3ul h-auto w-full"`.
 */
export function FlowerMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 50 43.49" {...props}>
      <path d="m40.74 30.36 2.6 4.51-4.97 8.62h-9.95L25 37.57l1.55-2.69L25 32.19l3.42-5.93h4.29l2.37 4.1h5.66ZM50 21.74l-4.97 8.62h-4.29l-2.37-4.1h-5.66l-2.6-4.51 2.61-4.51h-4.29l-3.42-5.92 1.55-2.69-1.55-2.69L28.42 0h9.95l4.97 8.62-2.61 4.51h4.29l4.97 8.62Zm-9.26-8.61h-5.66l-2.37 4.1h5.66l2.37-4.1ZM23.45 34.87 25 37.56l-3.42 5.93h-9.95l-4.97-8.62 2.61-4.51h-4.3L0 21.75l4.97-8.62h4.29l-2.6-4.51L11.63 0h9.95L25 5.92l-1.55 2.69L25 11.3l-3.42 5.93h-4.29l2.61 4.51-2.61 4.51h4.29L25 32.17l-1.55 2.69ZM11.63 17.23h5.66l-2.37-4.1H9.26l2.37 4.1Zm5.66 9.03h-5.66l-2.37 4.1h5.66l2.37-4.1Z" />
    </svg>
  );
}

/** Flat arrow used by the newsletter submit button — `viewBox="0 0 11 10.55"`. */
export function ArrowRight(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 11 10.55" {...props}>
      <path d="M5.5 10.55a.47.47 0 0 1-.35-.15c-.2-.2-.2-.51 0-.71L9.3 5.54H.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5h8.79L5.59.85c-.2-.2-.2-.51 0-.71s.51-.2.71 0l4.55 4.55.01.01s.07.1.1.15c.02.06.04.12.04.19s-.01.14-.04.19c-.02.06-.06.12-.11.16l-5 5c-.1.1-.23.15-.35.15Z" />
    </svg>
  );
}

/** Diagonal arrow used by buttons and the footer address row — `viewBox="0 0 17.57 17.57"`. */
export function ArrowRightUp(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 17.57 17.57" {...props}>
      <path d="M1.03 17.57c-.26 0-.53-.1-.73-.3-.4-.4-.4-1.06 0-1.46L14.04 2.07H1.03C.46 2.07 0 1.6 0 1.03S.46 0 1.03 0h15.53c.13 0 .25.03.36.08.12.05.23.12.33.22a1.04 1.04 0 0 1 .29.72v14.14c0 .57-.46 1.03-1.03 1.03s-1.03-.46-1.03-1.03V3.53L1.76 17.26c-.2.2-.47.3-.73.3Z" />
    </svg>
  );
}

/**
 * Audio toggle bars — the unmuted state in EVIDENCE §11: five `<line>` elements
 * inside a 24×24 box, each scaled on Y by a spectrum value (`0.3 | 0.6 | 1`).
 * `transform-origin` / `scaleY` are driven per-bar by the caller via `data-bars`.
 */
export function AudioBars({
  muted = true,
  ...props
}: SVGProps<SVGSVGElement> & { muted?: boolean }) {
  const bars = [
    { x: 4, scale: 0.3 },
    { x: 8, scale: muted ? 0.3 : 1 },
    { x: 12, scale: muted ? 0.3 : 0.6 },
    { x: 16, scale: muted ? 0.3 : 1 },
    { x: 20, scale: 0.3 },
  ];
  return (
    <svg viewBox="0 0 24 24" {...props}>
      {bars.map((bar) => (
        <line
          key={bar.x}
          x1={bar.x}
          y1={6}
          x2={bar.x}
          y2={18}
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          transform={`translate(0 ${12 - 12 * bar.scale}) scale(1 ${bar.scale})`}
          style={{ transformOrigin: `${bar.x}px 12px` }}
        />
      ))}
    </svg>
  );
}
