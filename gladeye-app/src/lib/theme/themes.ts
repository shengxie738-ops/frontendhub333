/**
 * Theme model — a 1:1 port of webpack module 4021 (`g()`) and the colour table in
 * module 5829 of `evidence/source-assets/js/131-8efcfd03f067c029.js`.
 *
 * The original never ships static theme classes: it resolves a *theme name*
 * ("dark" | "green" | "yellow" …) into three inline-style objects which are
 * spread onto `<main>`, the menu overlay and the header wrapper respectively.
 * Values are RGB triplets ("16 16 16") consumed as `rgb(var(--x) / <alpha>)`.
 */

export type ThemeName =
  | "green"
  | "purple"
  | "black"
  | "white"
  | "orange"
  | "yellow"
  | "mint"
  | "blue"
  | "light"
  | "dark"
  | "error";

export interface ThemeColors {
  primary?: string;
  secondary?: string;
  tertiary?: string;
  header?: string;
  headerSecondary?: string;
  headerButtonTextDefault?: string;
  /** NOTE: the original config spells this with a capital `O`. */
  headerButtonTextRollOVer?: string;
  headerButtonBgDefault?: string;
  headerButtonBgRollOver?: string;
  [key: string]: string | undefined;
}

/** module 5829 `theme.colors.theme`, verbatim (hex values included). */
export const THEME_COLORS: Record<ThemeName, ThemeColors> = {
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
    // Genuine typo in the original config (`RollOver` instead of `RollOVer`);
    // it makes `--theme-header-button-text-roll-over` fall back to `0 0 0`.
    headerButtonTextRollOver: "#000000",
    headerButtonBgDefault: "#7D7D7D",
    headerButtonBgRollOver: "#FFFFFF",
  },
};

export const THEME_NAMES = Object.keys(THEME_COLORS) as ThemeName[];

export const DEFAULT_THEME: ThemeName = "dark";

/** module 596 `oo()` — `#RRGGBB` -> `"r g b"`. */
export function hexToRgbTriplet(hex: string | undefined): string {
  if (!hex) return "";
  const int = parseInt(hex.replace("#", ""), 16);
  return `${int >> 16} ${(int >> 8) & 255} ${255 & int}`;
}

export type RgbTriplet = string;

export interface PageThemeVars {
  "--theme-primary": RgbTriplet;
  "--theme-secondary": RgbTriplet;
  "--theme-tertiary": RgbTriplet;
}

export interface MenuThemeVars {
  "--theme-primary": RgbTriplet;
  "--theme-secondary": RgbTriplet;
}

export interface HeaderThemeVars {
  "--theme-header": RgbTriplet;
  "--theme-header-secondary": RgbTriplet;
  "--theme-header-button-text-default": RgbTriplet;
  "--theme-header-button-text-roll-over": RgbTriplet;
  "--theme-header-button-bg-default": RgbTriplet;
  "--theme-header-button-bg-roll-over": RgbTriplet;
}

export interface ThemeVars {
  pageTheme: PageThemeVars;
  menuTheme: MenuThemeVars;
  headerTheme: HeaderThemeVars;
}

/** module 4021 `g(themeName)` — verbatim, defaults included. */
export function resolveTheme(name?: ThemeName | string): ThemeVars {
  // Mirrors `theme.colors.theme[e || "dark"]`: an unknown name yields `undefined`
  // and therefore the hard-coded defaults below, exactly like the original.
  const theme: ThemeColors | undefined = THEME_COLORS[(name || DEFAULT_THEME) as ThemeName];

  let primary = "0 0 0";
  let secondary = "255 255 255";
  let tertiary = "255 255 255";
  let header = "255 255 255";
  let headerSecondary = "255 255 255";
  let headerButtonTextDefault = "0 0 0";
  let headerButtonTextRollOVer = "0 0 0";
  let headerButtonBgDefault = "0 0 0";
  let headerButtonBgRollOver = "0 0 0";

  if (theme) {
    primary = hexToRgbTriplet(theme.primary);
    secondary = hexToRgbTriplet(theme.secondary);
    tertiary = hexToRgbTriplet(theme.tertiary);
    header = hexToRgbTriplet(theme.header);
    headerSecondary = hexToRgbTriplet(theme.headerSecondary);
    headerButtonTextDefault = hexToRgbTriplet(theme.headerButtonTextDefault);
    headerButtonTextRollOVer = hexToRgbTriplet(theme.headerButtonTextRollOVer);
    headerButtonBgDefault = hexToRgbTriplet(theme.headerButtonBgDefault);
    headerButtonBgRollOver = hexToRgbTriplet(theme.headerButtonBgRollOver);
  }

  return {
    pageTheme: {
      "--theme-primary": primary,
      "--theme-secondary": secondary,
      "--theme-tertiary": tertiary,
    },
    menuTheme: {
      "--theme-primary": primary,
      "--theme-secondary": secondary,
    },
    headerTheme: {
      "--theme-header": header,
      "--theme-header-secondary": headerSecondary,
      "--theme-header-button-text-default": headerButtonTextDefault,
      "--theme-header-button-text-roll-over": headerButtonTextRollOVer,
      "--theme-header-button-bg-default": headerButtonBgDefault,
      "--theme-header-button-bg-roll-over": headerButtonBgRollOver,
    },
  };
}

/**
 * Theme per route, read from the `theme` field of the Storyblok `page` /
 * `home` / `contact` / `career_index` payloads in `evidence/source-pages/*.html`
 * and the `data-theme` attributes present in the captured DOM.
 */
export const PAGE_THEMES: Record<string, ThemeName> = {
  "/": "dark",
  "/work": "light",
  "/about": "green",
  "/contact": "yellow",
  "/careers": "dark",
};

export function pageThemeForPath(pathname: string): ThemeName {
  const exact = PAGE_THEMES[pathname];
  if (exact) return exact;
  if (pathname.startsWith("/work/")) return "light";
  if (pathname.startsWith("/careers/")) return "dark";
  return DEFAULT_THEME;
}

/** The menu overlay always renders in the `green` theme (module 5299 `R="green"`). */
export const MENU_THEME: ThemeName = "green";
