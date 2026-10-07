export {
  acquireScrollLock,
  forceReleaseAllScrollLocks,
  isScrollLocked,
  releaseScrollLock,
  scrollLockOwnerCount,
  scrollLockOwners,
  scrollLockSavedScrollY,
  type AcquireOptions,
  type FillGapMethod,
  type ScrollLockOwner,
} from "./scroll-lock";

export {
  DEFAULT_THEME,
  MENU_THEME,
  PAGE_THEMES,
  THEME_COLORS,
  THEME_NAMES,
  hexToRgbTriplet,
  pageThemeForPath,
  resolveTheme,
  type HeaderThemeVars,
  type MenuThemeVars,
  type PageThemeVars,
  type ThemeName,
  type ThemeVars,
} from "./themes";

export { ThemeProvider, mergeHeaderStyle, useTheme } from "./theme-provider";

export {
  ADDRESS_HREF,
  ADDRESS_LABEL,
  CAREERS_EMAIL,
  CONTACT_EMAIL,
  FOOTER_GROUPS,
  IMPLEMENTED_ROUTES,
  NEWSLETTER_HEADING,
  NEWSLETTER_PLACEHOLDER,
  SITE_MENU,
  SOCIAL_LINKS,
  isMenuEntrySelected,
  type FooterGroup,
  type MenuItem,
  type SocialLink,
} from "./menu-items";

export {
  MenuProvider,
  useEscapeToClose,
  useFocusTrap,
  useMenu,
  type MenuContextValue,
} from "./menu-provider";

export { epicene, fontVariables, soehne } from "./fonts";
