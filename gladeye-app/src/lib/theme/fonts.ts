import localFont from "next/font/local";

/**
 * Gladeye's two brand families, declared with `next/font/local` so the fonts are
 * self-hosted, preloaded and free of the CLS the original pays for `swap`.
 *
 * Face inventory — verbatim from the original `@font-face` block in
 * `evidence/source-assets/_next/static/css/70ccb8e7fa150b80.css`:
 *
 *   Epicene  300 normal  epicene-text-light.0650b0f0.woff2
 *   Epicene  300 italic  epicene-text-light-italic.bab9dcbf.woff2   (a real italic)
 *   Soehne   500 normal  soehne-kraftig.9c83d0e0.woff2
 *   Soehne   300 normal  soehne-leicht.31cd3571.woff2
 *   Soehne   400 normal  soehne-buch.5a88e093.woff2  <- referenced by the original
 *                                   stylesheet but NOT present in the captured
 *                                   asset set, so it cannot be declared here.
 *
 * `variable` names are the contract the design tokens consume
 * (see src/styles/tokens.css `--font-stack-serif` / `--font-stack-sans`).
 */
export const epicene = localFont({
  variable: "--font-epicene",
  display: "swap",
  weight: "300",
  adjustFontFallback: "Times New Roman",
  fallback: ["Epicene", "ui-serif", "Georgia", "Cambria", '"Times New Roman"', "Times", "serif"],
  src: [
    {
      path: "../../app/fonts/epicene-text-light.0650b0f0.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../app/fonts/epicene-text-light-italic.bab9dcbf.woff2",
      weight: "300",
      style: "italic",
    },
  ],
});

export const soehne = localFont({
  variable: "--font-soehne",
  display: "swap",
  adjustFontFallback: "Arial",
  fallback: [
    "Soehne",
    "ui-sans-serif",
    "system-ui",
    "-apple-system",
    "BlinkMacSystemFont",
    '"Segoe UI"',
    "Roboto",
    '"Helvetica Neue"',
    "Arial",
    '"Noto Sans"',
    "sans-serif",
  ],
  src: [
    {
      path: "../../app/fonts/soehne-leicht.31cd3571.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../app/fonts/soehne-kraftig.9c83d0e0.woff2",
      weight: "500",
      style: "normal",
    },
  ],
});

/** Drop these on `<html>` from `app/layout.tsx`. */
export const fontVariables = `${epicene.variable} ${soehne.variable}`;
