import type { Config } from "tailwindcss";
import type { PluginAPI } from "tailwindcss/types/config";
import defaultTheme from "tailwindcss/defaultTheme";

/* -------------------------------------------------------------------------- */
/*  GLADEYE — faithful port of the original site's Tailwind configuration.     */
/*                                                                            */
/*  Source of truth (verbatim extractions, deliberately not "improved"):       */
/*   • docs/research/gladeye/EVIDENCE.md §9 (design tokens) / §10 (shell DOM)  */
/*   • evidence/source-assets/_next/static/css/70ccb8e7fa150b80.css            */
/*   • evidence/source-assets/js/131-8efcfd03f067c029.js                       */
/*       - module 5829 = the original `tailwind.config.js`                     */
/*       - module 4721 = the fluid `spacing` scale generator                   */
/*       - module 7603 = the `clamp()` helper                                  */
/*       - module 7324 = { MIN_VW: 375, MAX_VW: 1728 }                         */
/*       - module 2946 = the `.t-*` typography plugin                          */
/*       - module 4748 = the `.ui-*` component plugin                          */
/* -------------------------------------------------------------------------- */

/* ---- module 7324 ---------------------------------------------------------- */
const MIN_VW = 375;
const MAX_VW = 1728;

/** module 7603, verbatim: `r(e, t, n, s)`. */
function fluid(minRem: number, baseWidth: number, maxRem: number, maxWidth: number): string {
  const a = (n: number) => Math.round(10 * n) / 10;
  const slope = a((1600 * (maxRem - minRem)) / (maxWidth - baseWidth));
  const intercept = a(minRem - (baseWidth * (maxRem - minRem)) / (maxWidth - baseWidth));
  return `clamp(${minRem}rem, ${slope}vw ${intercept >= 0 ? "+" : "-"} ${Math.abs(
    intercept,
  )}rem, ${maxRem}rem)`;
}

const vw = (minRem: number, maxRem: number) => fluid(minRem, MIN_VW, maxRem, MAX_VW);

/** module 4721 — the linear rem scale the whole spacing system derives from. */
const SCALE: Array<[number, string]> = [
  [0.5, "0.125rem"],
  [1, "0.25rem"],
  [1.5, "0.375rem"],
  [2, "0.5rem"],
  [2.5, "0.625rem"],
  [3, "0.75rem"],
  [3.5, "0.875rem"],
  [4, "1rem"],
  [5, "1.25rem"],
  [6, "1.5rem"],
  [7, "1.75rem"],
  [8, "2rem"],
  [9, "2.25rem"],
  [10, "2.5rem"],
  [11, "2.75rem"],
  [12, "3rem"],
  [14, "3.5rem"],
  [16, "4rem"],
  [20, "5rem"],
  [24, "6rem"],
  [28, "7rem"],
  [32, "8rem"],
  [36, "9rem"],
  [40, "10rem"],
  [44, "11rem"],
  [48, "12rem"],
  [52, "13rem"],
  [56, "14rem"],
  [60, "15rem"],
  [64, "16rem"],
  [72, "18rem"],
  [80, "20rem"],
  [96, "24rem"],
];

const remValue = (v: string) => parseFloat(v.slice(0, -3));

/** module 4721 `F(back, prefix?)` — fluid, anchored `back` steps down the scale. */
function fluidScale(back: number, prefix?: string): Record<string, string> {
  const out: Record<string, string> = {};
  SCALE.forEach((entry, index) => {
    const [num, value] = entry;
    const from = SCALE[index - back];
    if (!from) return;
    const key = prefix ? `${prefix}-${num}` : `${num}`;
    out[key] = vw(remValue(from[1]), remValue(value));
  });
  return out;
}

/** module 4721 — the static (`s-*`) escape hatch: raw rem values, never fluid. */
function staticScale(): Record<string, string> {
  const out: Record<string, string> = {};
  SCALE.forEach(([num, value]) => {
    out[`s-${num}`] = value;
  });
  return out;
}

const spacing: Record<string, string> = {
  "0": "0",
  px: "1px",
  "2px": "2px",
  "3px": "3px",
  ...fluidScale(2),
  ...fluidScale(4, "lg"),
  ...fluidScale(6, "xl"),
  ...staticScale(),
  sms: vw(1, 1.5),
  sgs: vw(0.625, 1.5),
  "Header-height": "var(--site-header-height)",
  // Careers page imagery stays fluid against a wider (2560px) upper bound.
  "CareersImages-image-a": fluid(13.75, MIN_VW, 38.625, 2560),
  "CareersImages-image-b": fluid(19.375, MIN_VW, 53.8125, 2560),
};

/**
 * module 5829 `theme.colors.theme` — the named page / menu / header themes.
 * Values are verbatim, including the original's `headerButtonTextRollOVer`
 * spelling (capital `O`) and the `error` theme's genuine typo, which is why
 * `--theme-header-button-text-roll-over` legitimately falls back to `0 0 0`.
 */
const namedThemes = {
  green: {
    primary: "#013005",
    secondary: "#FFFFFF",
    tertiary: "#B8E3BC",
    header: "#FFFFFF",
    headerSecondary: "#FFFFFF",
    headerButtonTextDefault: "#FFFFFF",
    headerButtonBgDefault: "#7D7D7D",
    headerButtonTextRollOVer: "#000000",
    headerButtonBgRollOver: "#FFFFFF",
  },
  purple: {
    primary: "#D1A0F4",
    secondary: "#101010",
    tertiary: "#101010",
    header: "#101010",
    headerSecondary: "#7D7D7D",
    headerButtonTextDefault: "#FFFFFF",
    headerButtonTextRollOVer: "#000000",
    headerButtonBgDefault: "#7D7D7D",
    headerButtonBgRollOver: "#FFFFFF",
  },
  black: {
    primary: "#101010",
    secondary: "#FFFFFF",
    tertiary: "#FFFFFF",
    header: "#FFFFFF",
    headerSecondary: "#7D7D7D",
    headerButtonTextDefault: "#FFFFFF",
    headerButtonTextRollOVer: "#000000",
    headerButtonBgDefault: "#7D7D7D",
    headerButtonBgRollOver: "#FFFFFF",
  },
  white: {
    primary: "#FFFFFF",
    secondary: "#FF0000",
    tertiary: "#FF0000",
    header: "#000000",
    headerSecondary: "#7D7D7D",
    headerButtonTextDefault: "#FFFFFF",
    headerButtonTextRollOVer: "#000000",
    headerButtonBgDefault: "#7D7D7D",
    headerButtonBgRollOver: "#FFFFFF",
  },
  orange: {
    primary: "#FF743F",
    secondary: "#FFFFFF",
    tertiary: "#FFFFFF",
    header: "#FFFFFF",
    headerSecondary: "#7D7D7D",
    headerButtonTextDefault: "#FFFFFF",
    headerButtonTextRollOVer: "#000000",
    headerButtonBgDefault: "#7D7D7D",
    headerButtonBgRollOver: "#FFFFFF",
  },
  yellow: {
    primary: "#FBC500",
    secondary: "#000000",
    tertiary: "#000000",
    header: "#000000",
    headerSecondary: "#7D7D7D",
    headerButtonTextDefault: "#FFFFFF",
    headerButtonTextRollOVer: "#000000",
    headerButtonBgDefault: "#7D7D7D",
    headerButtonBgRollOver: "#FFFFFF",
  },
  mint: {
    primary: "#B8E3BC",
    secondary: "#FFFFFF",
    tertiary: "#FFFFFF",
    header: "#000000",
    headerSecondary: "#7D7D7D",
    headerButtonTextDefault: "#FFFFFF",
    headerButtonTextRollOVer: "#000000",
    headerButtonBgDefault: "#7D7D7D",
    headerButtonBgRollOver: "#FFFFFF",
  },
  blue: {
    primary: "#5B8AFA",
    secondary: "#FFFFFF",
    tertiary: "#FFFFFF",
    header: "#FFFFFF",
    headerSecondary: "#7D7D7D",
    headerButtonTextDefault: "#FFFFFF",
    headerButtonTextRollOVer: "#000000",
    headerButtonBgDefault: "#7D7D7D",
    headerButtonBgRollOver: "#FFFFFF",
  },
  light: {
    primary: "#FFFFFF",
    secondary: "#101010",
    tertiary: "#101010",
    header: "#101010",
    headerSecondary: "#7D7D7D",
    headerButtonTextDefault: "#101010",
    headerButtonTextRollOVer: "#FFFFFF",
    headerButtonBgDefault: "#7D7D7D",
    headerButtonBgRollOver: "#101010",
  },
  dark: {
    primary: "#101010",
    secondary: "#FFFFFF",
    tertiary: "#FFFFFF",
    header: "#FFFFFF",
    headerSecondary: "#7D7D7D",
    headerButtonTextDefault: "#FFFFFF",
    headerButtonTextRollOVer: "#000000",
    headerButtonBgDefault: "#7D7D7D",
    headerButtonBgRollOver: "#FFFFFF",
  },
  error: {
    primary: "#101010",
    secondary: "#00FF00",
    tertiary: "#00FF00",
    header: "#00FF00",
    headerSecondary: "#7D7D7D",
    headerButtonTextRollOver: "#000000",
    headerButtonBgDefault: "#7D7D7D",
    headerButtonBgRollOver: "#FFFFFF",
  },
} as const;

/* ---- module 2946 — the `.t-*` typography plugin -------------------------- */
interface TypeToken {
  fontSize: string;
  fontStack: string;
  fontWeight?: number;
  lineHeight: string;
  letterSpacing?: string;
  textTransform?: "uppercase";
}

const SERIF_STACK = "var(--font-stack-serif)";
const SANS_STACK = "var(--font-stack-sans)";

const typographyTokens: Record<string, TypeToken> = {
  "t-d1": { fontSize: vw(4, 15.625), fontStack: SERIF_STACK, fontWeight: 300, lineHeight: "100%", letterSpacing: "-0.03em" },
  "t-d2": { fontSize: vw(2.625, 6.5), fontStack: SERIF_STACK, fontWeight: 300, lineHeight: "110%", letterSpacing: "-0.01em" },
  "t-d3": { fontSize: vw(1.6875, 6.5), fontStack: SERIF_STACK, fontWeight: 300, lineHeight: "110%", letterSpacing: "-0.01em" },
  "t-h1": { fontSize: vw(2.5, 8), fontStack: SERIF_STACK, fontWeight: 300, lineHeight: "100%", letterSpacing: "-0.02em" },
  "t-h2": { fontSize: vw(2, 5), fontStack: SERIF_STACK, fontWeight: 300, lineHeight: "110%", letterSpacing: "-0.01em" },
  "t-h3": { fontSize: vw(1.5, 3.5), fontStack: SERIF_STACK, fontWeight: 300, lineHeight: "110%", letterSpacing: "-0.01em" },
  "work-h3": { fontSize: vw(1.5, 3), fontStack: SERIF_STACK, fontWeight: 300, lineHeight: "150%", letterSpacing: "-0.01em" },
  "t-h4": { fontSize: vw(1.125, 2.5), fontStack: SERIF_STACK, fontWeight: 300, lineHeight: "110%", letterSpacing: "-0.01em" },
  "t-h5": { fontSize: vw(1, 2), fontStack: SERIF_STACK, fontWeight: 300, lineHeight: "110%", letterSpacing: "-0.01em" },
  "t-p-lg": { fontSize: vw(1.25, 1.75), fontStack: SANS_STACK, fontWeight: 300, lineHeight: "130%", letterSpacing: "-0.01em" },
  "t-p-lg-alt": { fontSize: vw(1.25, 1.75), fontStack: SERIF_STACK, fontWeight: 300, lineHeight: "130%", letterSpacing: "-0.01em" },
  "t-p-md": { fontSize: vw(1.1875, 1.5), fontStack: SANS_STACK, fontWeight: 300, lineHeight: "130%", letterSpacing: "-0.01em" },
  "t-p-md-alt": { fontSize: vw(1.1875, 1.5), fontStack: SERIF_STACK, fontWeight: 300, lineHeight: "130%", letterSpacing: "-0.01em" },
  "t-p": { fontSize: vw(1, 1.1875), fontStack: SANS_STACK, fontWeight: 300, lineHeight: "145%", letterSpacing: "-0.01em" },
  "t-p-sm": { fontSize: vw(0.875, 1), fontStack: SANS_STACK, fontWeight: 300, lineHeight: "140%", letterSpacing: "-0.01em" },
  "t-p-xs": { fontSize: "0.875rem", fontStack: SANS_STACK, fontWeight: 300, lineHeight: "140%", letterSpacing: "-0.01em" },
  "t-meta": { fontSize: vw(0.5, 0.75), fontStack: SANS_STACK, fontWeight: 400, lineHeight: "100%", letterSpacing: "0.08em", textTransform: "uppercase" },
  "t-btn-menu": { fontSize: "14px", fontStack: SANS_STACK, fontWeight: 500, lineHeight: "100%", letterSpacing: "0.01em" },
  "t-team-meta": { fontSize: vw(0.5, 1.1875), fontStack: SANS_STACK, fontWeight: 300, lineHeight: "145%", letterSpacing: "-0.01em" },
  "t-list": { fontSize: vw(0.75, 1.5), fontStack: SANS_STACK, fontWeight: 400, lineHeight: "130%", letterSpacing: "-0.01em" },
  "t-list-sm": { fontSize: vw(0.75, 1), fontStack: SANS_STACK, fontWeight: 400, lineHeight: "130%", letterSpacing: "-0.01em" },
  "t-footer-meta": { fontSize: "16px", fontStack: SANS_STACK, lineHeight: "140%", letterSpacing: "-0.004em" },
  "t-menu-item": { fontSize: vw(2.5, 6.125), fontStack: SERIF_STACK, fontWeight: 300, lineHeight: "100%", letterSpacing: "-0.02em" },
  "t-menu-meta": { fontSize: vw(0.75, 1), fontStack: SANS_STACK, lineHeight: "140%", letterSpacing: "-0.004em" },
  "t-contact-meta": { fontSize: vw(0.75, 1), fontStack: SANS_STACK, lineHeight: "140%", letterSpacing: "-0.004em" },
  "t-contact-greeting": { fontSize: vw(6.25, 15.625), fontStack: SERIF_STACK, fontWeight: 300, lineHeight: "130%", letterSpacing: "-0.03em" },
  "t-work-award": { fontSize: vw(0.75, 1.5), fontStack: SANS_STACK, fontWeight: 300, lineHeight: "130%", letterSpacing: "-0.01em" },
  "t-work-award-alt": { fontSize: vw(0.75, 1.5), fontStack: SERIF_STACK, fontWeight: 300, lineHeight: "130%", letterSpacing: "-0.01em" },
  "t-work-stat": { fontSize: vw(0.75, 1.1875), fontStack: SANS_STACK, fontWeight: 300, lineHeight: "130%", letterSpacing: "-0.01em" },
  "t-work-show-all": { fontSize: vw(0.625, 0.8125), fontStack: SANS_STACK, fontWeight: 400, lineHeight: "130%" },
  // The original computes a clamp and then overwrites `fontSize` with a max().
  "t-hero": { fontSize: "max(4.5vw, 2rem)", fontStack: SERIF_STACK, fontWeight: 300, lineHeight: "110%", letterSpacing: "0" },
  "t-contact": { fontSize: vw(3.5, 16), fontStack: SERIF_STACK, fontWeight: 300, lineHeight: "100%", letterSpacing: "-0.03em" },
};

/** `.t-btn-menu` grows to 19px from the `sm` breakpoint up (plugin, verbatim). */
const typographySmOverrides: Record<string, Record<string, string>> = {
  ".t-btn-menu": { fontSize: "19px" },
};

const buildTypographyRules = (): Record<string, Record<string, string>> => {
  const styles: Record<string, Record<string, string>> = {};
  for (const [name, token] of Object.entries(typographyTokens)) {
    const rule: Record<string, string> = {
      fontSize: token.fontSize,
      fontFamily: token.fontStack,
      lineHeight: token.lineHeight,
    };
    if (token.letterSpacing !== undefined) rule.letterSpacing = token.letterSpacing;
    if (token.fontWeight !== undefined) rule.fontWeight = String(token.fontWeight);
    if (token.textTransform) rule.textTransform = token.textTransform;
    styles[`.${name}`] = rule;
  }
  return styles;
};

const gladeyeTypographyPlugin = ({
  addComponents,
}: PluginAPI) => {
  const styles = buildTypographyRules();

  addComponents({
    ...styles,
    // `t-btn-menu` steps 14px -> 19px at `sm` (plugin, verbatim); `sm:t-p` is the
    // responsive form the original DOM uses, and is byte-identical to base `t-p`.
    "@media (min-width: 640px)": {
      ".sm\\:t-btn-menu": typographySmOverrides[".t-btn-menu"],
      ".sm\\:t-p": styles[".t-p"],
    },
    // Remaining responsive forms found in 70ccb8e7…css.
    "@media (min-width: 768px)": {
      ".md\\:t-p-md": styles[".t-p-md"],
      ".md\\:t-footer-meta": styles[".t-footer-meta"],
    },
  });
};

/** module 4748 — `.ui-grid`, `.ui-link`, `.ui-link-underline`. */
const gladeyeUiPlugin = ({ addComponents }: PluginAPI) => {
  addComponents({
    ".ui-grid": {
      display: "grid",
      gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
      columnGap: spacing.sgs,
      paddingLeft: spacing.sms,
      paddingRight: spacing.sms,
      "@media (min-width: 1024px)": {
        gridTemplateColumns: "repeat(24, minmax(0, 1fr))",
      },
    },
    ".ui-link": {
      opacity: "1",
      transitionDuration: "500ms",
      transitionProperty: "opacity",
      transitionTimingFunction: "cubic-bezier(0.165, 0.84, 0.44, 1)",
      "@media (hover: hover)": {
        "&:hover": { opacity: "0.5" },
      },
    },
    ".ui-link-underline": {
      position: "relative",
      "&::before": {
        content: '""',
        position: "absolute",
        bottom: "-1px",
        left: "0",
        width: "100%",
        height: "2px",
        backgroundColor: "currentColor",
        opacity: "1",
        transitionDuration: "500ms",
        transitionProperty: "opacity",
        transitionTimingFunction: "cubic-bezier(0.165, 0.84, 0.44, 1)",
      },
      "@media (hover: hover)": {
        "&:hover": { "&::before": { opacity: "0.5" } },
      },
    },
  });
};

const gridColumn: Record<string, string> = {};
const gridTemplateColumns: Record<string, string> = {};
const gridColumnStart: Record<string, string> = {};
for (let n = 13; n <= 24; n += 1) {
  gridColumn[`span-${n}`] = `span ${n} / span ${n}`;
  gridTemplateColumns[`${n}`] = `repeat(${n}, minmax(0, 1fr))`;
  gridColumnStart[`${n + 1}`] = `${n + 1}`;
}

const themeColorVars = [
  "theme-primary",
  "theme-secondary",
  "theme-tertiary",
  "theme-header",
  "theme-header-secondary",
  "theme-header-button-text-default",
  "theme-header-button-text-roll-over",
  "theme-header-button-bg-default",
  "theme-header-button-bg-roll-over",
] as const;

/** Tailwind accepts arrays for CSS fallbacks; the `extend` type only declares string. */
const SCREEN_HEIGHTS = ["100vh", "100svh"] as unknown as string;

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/experience/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/styles/**/*.{css,js,ts,jsx,tsx,mdx}",
    "./src/content/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    // module 5829 replaces (rather than extends) fontFamily, colors and spacing.
    fontFamily: {
      sans: ["var(--font-soehne)", "Soehne", ...defaultTheme.fontFamily.sans],
      serif: ["var(--font-epicene)", "Epicene", ...defaultTheme.fontFamily.serif],
    },
    colors: {
      current: "currentColor",
      transparent: "transparent",
      black: "#101010",
      white: "#FFFFFF",
      yellow: "#FBC500",
      orange: "#FF743F",
      mint: "#B8E3BC",
      gray: { DEFAULT: "#383838" },
      theme: namedThemes,
      ...Object.fromEntries(
        themeColorVars.map((name) => [name, `rgb(var(--${name}) / <alpha-value>)`]),
      ),
    },
    spacing,
    extend: {
      screens: {
        footerLarge: "1180px",
        desktop: "1728px",
        site: "1828px",
      },
      gridTemplateColumns,
      gridColumn,
      gridColumnStart,
      zIndex: {
        Footer: "50",
        main: "100",
        Menu: "150",
        Header: "200",
      },
      transitionProperty: {
        bg: "background-color",
      },
      transitionDuration: {
        theme: "500ms",
      },
      height: {
        screen: SCREEN_HEIGHTS,
        "Header-height": "var(--site-header-height)",
      },
      minHeight: {
        screen: SCREEN_HEIGHTS,
      },
      maxWidth: {
        site: "1828px",
      },
      transitionTimingFunction: {
        DEFAULT: "cubic-bezier(0.165, 0.84, 0.44, 1)",
      },
    },
  },
  plugins: [gladeyeTypographyPlugin, gladeyeUiPlugin],
};

export default config;

export {
  fluid,
  fluidScale,
  namedThemes,
  spacing,
  staticScale,
  typographyTokens,
  themeColorVars,
  SCALE,
  MIN_VW,
  MAX_VW,
};
