import type { ThemeName } from "./themes";

/**
 * The primary menu, transcribed from the Storyblok `settings_menu_item` payload
 * embedded in `evidence/source-pages/_about.html` (script chunk `c:["$","$L15",…{"menu":[…`).
 *
 * Order and labels are exactly as captured — the original has SIX entries and
 * nothing is added here:
 *   home → work → about → ventures → careers → contact
 *
 * `href` is derived with the original's own resolver (webpack module 596 `Rg()`):
 *   linktype "story"  -> "/" + cached_url, with cached_url "home" collapsing to "/"
 *   linktype "email"  -> "mailto:" + cached_url
 *   linktype "url"    -> cached_url (phone-number-looking values become "tel:")
 * Trailing slashes are normalised away because Next.js serves these routes
 * without them (`/work/` would otherwise 308-redirect on every click).
 */
export interface MenuItem {
  /** Storyblok `_uid`, kept so the React key matches the original. */
  uid: string;
  label: string;
  href: string;
  /** Per-item accent theme from the CMS (used by the rollover imagery). */
  theme: ThemeName;
  /** `cached_url` verbatim — drives the "selected" comparison. */
  cachedUrl: string;
  linkType: "story" | "url" | "email";
  external: boolean;
}

export const SITE_MENU: readonly MenuItem[] = [
  {
    uid: "2a11f63d-cf09-4633-b541-919ff2999b50",
    label: "Home",
    href: "/",
    theme: "orange",
    cachedUrl: "home",
    linkType: "story",
    external: false,
  },
  {
    uid: "9bf2b490-5c6d-498e-a80f-3f24fbe8ad32",
    label: "Work",
    href: "/work",
    theme: "purple",
    cachedUrl: "work/",
    linkType: "story",
    external: false,
  },
  {
    uid: "6a7fb339-05a3-41df-b598-71c7257510d9",
    label: "About",
    href: "/about",
    theme: "mint",
    cachedUrl: "about",
    linkType: "story",
    external: false,
  },
  {
    uid: "25a9aeec-2108-4b38-9399-b020d6479aad",
    label: "Ventures",
    href: "/ventures",
    theme: "white",
    cachedUrl: "ventures",
    linkType: "story",
    external: false,
  },
  {
    uid: "b26f9b89-a016-43b3-90c0-4c41aefd896a",
    label: "Careers",
    href: "/careers",
    theme: "black",
    cachedUrl: "careers/",
    linkType: "story",
    external: false,
  },
  {
    uid: "07bb18b7-d3db-47e8-820a-36ecfcec4057",
    label: "Contact",
    href: "/contact",
    theme: "yellow",
    cachedUrl: "contact",
    linkType: "story",
    external: false,
  },
] as const;

/**
 * Route the site currently implements. `Ventures` exists in the original nav and
 * its payload carries no `page` theme, so it is kept in the menu for fidelity;
 * `RouteShell` marks such entries with `data-menu-entry="unbuilt"`.
 */
export const IMPLEMENTED_ROUTES: readonly string[] = [
  "/",
  "/work",
  "/about",
  "/contact",
  "/careers",
];

/** module 5299 `F` — the "selected" comparison, verbatim. */
export function isMenuEntrySelected(pathname: string, cachedUrl: string): boolean {
  const strip = (value: string) => value.replace(/^\/|\/$/g, "");
  const current = pathname !== "/" ? strip(pathname) : "home";
  return current === strip(cachedUrl);
}

/* -------------------------------------------------------------------------- */

export interface SocialLink {
  label: string;
  href: string;
  /** Rendered after every entry except the last of a group (module 7946). */
  separator: "|" | null;
}

/**
 * `evidence/content/_contact.json` → links, and the JSON-LD `sameAs` list:
 * instagram `gladeyedigital`, linkedin `gladeye`, twitter `gladeye`.
 */
export const SOCIAL_LINKS: readonly SocialLink[] = [
  { label: "Instagram", href: "https://www.instagram.com/gladeyedigital/", separator: "|" },
  { label: "LinkedIn", href: "https://linkedin.com/company/gladeye", separator: "|" },
  { label: "X", href: "https://twitter.com/gladeye", separator: null },
];

/** `Request a proposal` / `Join the team` / `Find us` groups (module 7946). */
export const CONTACT_EMAIL = "hello@gladeye.com";
export const CAREERS_EMAIL = "careers@gladeye.com";
export const ADDRESS_LABEL = "29 Princes Street, Auckland 1010";
export const ADDRESS_HREF =
  "https://www.google.com/maps/place/Gladeye/@-36.8497288,174.7662306,17z/data=!3m1!4b1!4m6!3m5!1s0x6d0d480fd64adab1:0xfa505ffed6ead32a!8m2!3d-36.8497288!4d174.7688055!16s%2Fg%2F1q5gm4f92?entry=ttu";

export interface FooterGroup {
  heading: string;
  items: ReadonlyArray<{ label: string; href: string; external: boolean }>;
}

export const FOOTER_GROUPS: readonly FooterGroup[] = [
  {
    heading: "Request a proposal",
    items: [{ label: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}`, external: false }],
  },
  {
    heading: "Follow us",
    items: SOCIAL_LINKS.map((s) => ({ label: s.label, href: s.href, external: true })),
  },
  {
    heading: "Join the team",
    items: [{ label: CAREERS_EMAIL, href: `mailto:${CAREERS_EMAIL}`, external: false }],
  },
  {
    heading: "Find us",
    items: [{ label: ADDRESS_LABEL, href: ADDRESS_HREF, external: true }],
  },
] as const;

export const NEWSLETTER_HEADING = "Subscribe to\nour newsletter";
export const NEWSLETTER_PLACEHOLDER = "Your Email";
