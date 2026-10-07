/**
 * pages-schema.ts — type definitions for the /about, /contact and /careers
 * content files in this directory.
 *
 * Scope note: this file is owned by the info-pages builder only.
 * `src/content/schema.ts` belongs to another builder and is deliberately
 * not imported or modified here.
 *
 * Every string in the sibling JSON files is copied verbatim from the frozen
 * Storyblok payloads embedded in `evidence/source-pages/_<route>.html`
 * (the `self.__next_f` RSC stream). Nothing has been re-cased, re-punctuated,
 * re-numbered or "updated to today".
 */

/* ------------------------------------------------------------------ *
 * Shared primitives
 * ------------------------------------------------------------------ */

/**
 * `data-theme` values observed on these three routes, plus the rest of the
 * authoritative palette harvested from the site's Tailwind config
 * (`evidence/source-assets/js/131-8efcfd03f067c029.js`, module 131,
 * `theme.colors.theme`).
 */
export type GladeyeTheme =
  | 'green'
  | 'black'
  | 'yellow'
  | 'dark'
  | 'light'
  | 'mint'
  | 'orange'
  | 'blue'
  | 'purple'
  | 'white'
  | 'error';

/** Inline node of a Storyblok/ProseMirror rich-text document. */
export type InlineNode =
  | { t: 'text'; v: string }
  | { t: 'br' }
  | { t: 'i'; v: string }
  | { t: 'b'; v: string }
  | { t: 'span'; v: string; color: string }
  | { t: 'a'; v: string; href: string; target?: string | null; linktype?: string | null }
  | { t: 'emoji'; v: string; name: string };

/**
 * One paragraph of a Storyblok/ProseMirror rich-text document: the ordered list
 * of inline nodes the CMS stores for it.
 *
 * This mirrors the shape the frozen payload actually ships — `columns` on
 * /about and `body` on /careers are `RichLine[]`, i.e. `InlineNode[][]`.
 * `evidence/source-pages/_about.html` confirms each entry becomes exactly one
 * `<p class="break-inside-avoid-column">`, with no nested list markup.
 */
export type RichLine = InlineNode[];

/** A Storyblok asset reference reduced to what the DOM actually needs. */
export interface ImageRef {
  /** Absolute original Storyblok URL (source of truth for the download). */
  filename: string;
  alt: string;
  /** Storyblok asset id. */
  id: number;
  /** `<W>x<H>` segment taken straight out of the asset path. */
  dims: string;
  focus?: string;
  order?: number;
  _uid?: string;
}

export interface SeoBlock {
  _uid: string;
  title: string;
  description: string;
}

/* ------------------------------------------------------------------ *
 * /about
 * ------------------------------------------------------------------ */

export interface AboutHero {
  order: number;
  _uid: null;
  theme: GladeyeTheme;
  /** `t-d2` desktop heading: "Design creates the future. / Let's make it <i>beautiful</i>." */
  heading: InlineNode[];
  /** `t-d2` compact (<md) heading, a different line-break/italic layout. */
  headingCompact: InlineNode[];
  image: ImageRef;
  imagePortrait: ImageRef;
}

/** `page_bloks_content` — lead sentence + 2-column body copy (+ optional media). */
export interface AboutContentSection {
  order: number;
  _uid: string;
  component: 'page_bloks_content';
  theme: GladeyeTheme;
  heading: string;
  lead: InlineNode[];
  columns: RichLine[];
  media: ImageRef[];
}

/** `page_bloks_definition_list` — the "Our services" term/definition grid. */
export interface AboutServiceGroup {
  _uid: string;
  /** Verbatim, including the source's trailing spaces ("Digital ", "Brand "). */
  heading: string;
  items: string[];
}

export interface AboutServicesSection {
  order: number;
  _uid: string;
  component: 'page_bloks_definition_list';
  theme: GladeyeTheme;
  heading: string;
  groups: AboutServiceGroup[];
}

/** `page_bloks_awards` — frozen counts. Do not "refresh" these numbers. */
export interface AboutAwardItem {
  _uid: string;
  /** Verbatim, including the source's trailing space ("Winner "). */
  name: string;
  /** Storyblok stores quantity as a string. */
  quantity: string;
}

export interface AboutAwardGroup {
  _uid: string;
  type: string;
  /** Empty string when the CMS link is an unresolved `story` link (renders as plain text). */
  href: string;
  items: AboutAwardItem[];
}

export interface AboutAwardsSection {
  order: number;
  _uid: string;
  component: 'page_bloks_awards';
  theme: GladeyeTheme;
  heading: string;
  /** Rendered as "( 216 )" in the frozen DOM. */
  countLabel: string;
  groupsTotal: number;
  /** Sum of every `quantity` — must equal `countLabel` (216). Verified. */
  computedTotal: number;
  groups: AboutAwardGroup[];
}

/**
 * `page_bloks_careers` — the frozen page has `careers: []`, so the original
 * renders an empty green section. Reproduced as-is; no roles are invented.
 */
export interface AboutCareersSection {
  order: number;
  _uid: string;
  component: 'page_bloks_careers';
  theme: GladeyeTheme;
  heading: string;
  roles: unknown[];
}

export type AboutSection =
  | AboutContentSection
  | AboutServicesSection
  | AboutAwardsSection
  | AboutCareersSection;

export interface AboutPage {
  _uid: string;
  route: '/about';
  storyUuid: string;
  storyName: string;
  /** Frozen publish stamp: 2024-10-10. */
  publishedAt: string;
  sourceHtml: string;
  seo: SeoBlock;
  hero: AboutHero;
  sections: AboutSection[];
}

/* ------------------------------------------------------------------ *
 * /contact
 * ------------------------------------------------------------------ */

/**
 * DOM facts captured from `evidence/source-pages/_contact.html`. These are the
 * evidence for the greeting's interaction model — see GreetingMarquee.tsx.
 */
export interface GreetingDomEvidence {
  mainClass: string;
  wrapperClass: string;
  trackClass: string;
  itemClass: string;
  /** Number of identical 65-item tracks found in the server-rendered HTML. */
  copiesInDom: number;
  copyLengths: number[];
  /** `[true, true]` — ids `_0.._64` exist on copy 1 only; copy 2 has none. */
  idsOnFirstCopyOnly: boolean[];
  firstIds: string[];
  lastId: string;
  /** Each item renders the greeting plus a trailing comma. */
  renderedWithTrailingComma: string[];
  mainCssDeclaration: string;
  mainCssDeclarationSmall: string;
  typographyCss: string;
  /** No `@keyframes`/`animation` exists for this component in any shipped CSS. */
  cssKeyframesPresent: false;
}

export interface ContactGreetings {
  order: number;
  /** Storyblok field name this list came from. */
  sourceField: 'greetings';
  /** The raw comma-separated CMS string, verbatim. */
  raw: string;
  /** 65 greetings, commas stripped, order preserved. */
  list: string[];
  count: number;
  domEvidence: GreetingDomEvidence;
  items: Array<{ order: number; id: string; rendered: string }>;
}

export interface ContactLinkItem {
  label: string;
  href: string;
  target: string | null;
  rel: string | null;
  /** `'|'` separator rendered after this item, or null. */
  separator: string | null;
  /** MotionLink duplicates its label into two spans for the roll-over. */
  spans: number;
}

export interface ContactBlock {
  heading: string;
  headingClass: string;
  wrapperClass: string;
  linkClass: string;
  innerClass: string;
  items: ContactLinkItem[];
}

export interface ContactPage {
  _uid: string;
  route: '/contact';
  storyUuid: string;
  storyName: string;
  publishedAt: string;
  firstPublishedAt: string;
  component: 'contact';
  sourceHtml: string;
  cssModule: { name: string; mainClass: string; sourceCss: string };
  seo: SeoBlock;
  theme: GladeyeTheme;
  greetings: ContactGreetings;
  intro: { order: number; className: string; text: string };
  blocks: { order: number; wrapperClass: string; groups: ContactBlock[] };
  /** The hero block carries its own copyright line, distinct from the footer's. */
  copyrightInPage: { order: number; text: string };
  /** Greetings containing non-ASCII characters — completeness assertion target. */
  nonAsciiGreetings: string[];
}

/* ------------------------------------------------------------------ *
 * /careers
 * ------------------------------------------------------------------ */

/**
 * One image of the horizontal `CareersImages` band. The frozen DOM contains
 * 21 images twice (`_0.._20` on copy 1, un-idd clone as copy 2).
 */
export interface CareersImage extends ImageRef {
  order: number;
}

/** Shape cycle declared by `.CareersImages_item__uJrZv:nth-child(3n+k)`. */
export interface CareersItemShape {
  /** `3n+1` | `3n+2` | `3n+3` */
  selector: string;
  width: string;
  aspectRatio: string;
  borderRadiusTop: string | null;
}

export interface CareersRoleRow {
  href: string;
  location: string;
  title: string;
  category: string;
  cta: string;
}

export interface CareersPage {
  _uid: string;
  route: '/careers';
  storyUuid: string;
  storyName: string;
  component: 'career_index';
  sourceHtml: string;
  seo: SeoBlock;
  theme: GladeyeTheme;
  heading: InlineNode[];
  body: RichLine[];
  images: CareersImage[];
  roles: { heading: string; countLabel: string; items: CareersRoleRow[] };
}

/* ------------------------------------------------------------------ *
 * Motion contract (shared by the two marquees)
 * ------------------------------------------------------------------ */

export interface MarqueeParams {
  /** Travel speed in CSS px/second. */
  speedPxPerSecond: number;
  /** Direction of travel. */
  direction: 'left' | 'right';
  /** How many identical DOM copies make one seamless period. */
  copies: number;
  /**
   * `true` when the rate is backed by shipped CSS/JS; `false` when the value is
   * our own reproducible placeholder. This describes the timing input's
   * provenance, not completed multi-viewport visual acceptance.
   */
  rateVerified: boolean;
}

/**
 * Captured module 983 rounds first-copy clientWidth / 100 to whole seconds.
 * Live Contact samples at 1180×757 on 2026-10-07 measured ≈99.865px/s.
 * The source-backed 100px/s input is verified; four-viewport QA is pending.
 */
export const CONTACT_MARQUEE: MarqueeParams = {
  speedPxPerSecond: 100,
  direction: 'left',
  copies: 2,
  rateVerified: true,
};

/** Same engine as the greeting band; shape cycle comes from shipped CSS. */
export const CAREERS_MARQUEE: MarqueeParams = {
  speedPxPerSecond: 60,
  direction: 'left',
  copies: 2,
  rateVerified: false,
};
