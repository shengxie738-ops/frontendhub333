/**
 * Work / case-study content types (only these two page families live here).
 * Values are produced by `gladeye-app/scripts/build-work-data.mjs` from the captured
 * RSC payloads + rendered HTML in `evidence/source-pages/`.
 */

export type ThemeName = 'dark' | 'light';

/** One character-level style run of a Storyblok ProseMirror document. */
export interface RichRun {
  text: string;
  /** bold */
  b?: 1;
  /** italic */
  i?: 1;
  /** explicit colour from the CMS textStyle mark (verbatim hex / rgb()) */
  c?: string;
  fontSize?: string;
  href?: string | null;
  target?: string;
}

export type RichNode =
  | { t: 'p'; runs: RichRun[] }
  | { t: 'ul' | 'ol'; items: { runs: RichRun[] }[] }
  | { t: 'h'; level: number; runs: RichRun[] }
  | { t: 'hr' }
  | { t: 'inlineImage'; src: string };

export interface ImageAsset {
  kind: 'image';
  /** original Storyblok URL (no /m/ transform, no /_next/image wrapper) */
  src: string;
  /** file name inside public/sites/gladeye/work/<slug>/ */
  local: string;
  naturalWidth: number | null;
  naturalHeight: number | null;
  naturalRatio: number | null;
  alt: string;
}

export interface MetadataEntry {
  label: string;
  value: string;
  href?: string | null;
}

/**
 * Media frame as rendered by the original DOM: a fixed aspect container inside
 * `.ui-grid`, image painted with object-fit:cover at 50% 50%, sitting on top of the
 * project's accent colour (or brand yellow when the project has no accent).
 *
 * The frame is a **union over `kind`**, because that is what `projects.json` actually
 * contains — audited over all 42 projects (every value below is the key set that appears
 * in the JSON, not a wish):
 *
 *   kind:'image'    198 items — always carries `image` (never null in the data)
 *   kind:'video'     83 items — always carries `vimeoId` + `source` + `embedAspect`,
 *                                `aspectRatio` is `null | 'natural' | 'design'`
 *   kind:'carousel' 108 items — always carries `images[]` + `intervalMs`, `durationMs`
 *                                only when the CMS set an explicit fade
 *
 * Splitting by kind is what lets `CaseMedia.tsx` pass `item.source` to a `<video>`
 * without widening the type to `string | undefined`.
 */
interface MediaFrame {
  /** verbatim class list of the frame div in the original DOM */
  frameClass: string;
  /** numeric aspect ratio of that frame (w / h) */
  frameRatio: number | null;
  objectFit: 'cover';
  objectPosition: '50% 50%';
  frameBackground: string;
  /** 'from-dom' when taken from the captured page, 'derived' when from the shared rule */
  layout: 'from-dom' | 'derived';
}

export interface ImageMediaItem extends MediaFrame {
  kind: 'image';
  image: ImageAsset | null;
}

export interface VideoMediaItem extends MediaFrame {
  kind: 'video';
  vimeoId: string | null;
  /**
   * Storyblok `work_bloks_video.source`, verbatim. Two shapes occur: a playable file
   * (`player.vimeo.com/progressive_redirect/…file.mp4?signature=…`) and a Vimeo *page*
   * link (`vimeo.com/<id>…`) which the original hands to its player embed — see
   * `isPlayableFileSource`.
   */
  source: string;
  embedAspect: number;
  /** CMS aspect preference: `null` = unset, otherwise 'natural' | 'design' */
  aspectRatio: 'natural' | 'design' | null;
}

export interface CarouselMediaItem extends MediaFrame {
  kind: 'carousel';
  images: ImageAsset[];
  /** how long a slide holds (ms); always present on carousel items in the data */
  intervalMs: number;
  /** cross-fade length (ms); absent when the CMS left it at the component default */
  durationMs?: number;
}

export type MediaItem = ImageMediaItem | VideoMediaItem | CarouselMediaItem;

/* --------------------------------------------------------------- case blocks -- */

/** `work_bloks_images_videos` with 1 frame (`work_bloks_image`) inside a `.ui-grid`. */
export interface ContainedMediaBlock {
  type: 'contained-media';
  wrapClass: string;
  items: MediaItem[];
}

/** Two side-by-side frames; the CMS also mirrors the frames into `slides`. */
export interface MediaPairBlock {
  type: 'media-pair';
  wrapClass: string;
  items: MediaItem[];
  slides?: ImageAsset[];
}

/** Several frames stacked in one frame, cross-faded by `MediaCarousel`. */
export interface MediaCarouselBlock {
  type: 'media-carousel';
  wrapClass: string;
  items: MediaItem[];
  slides?: ImageAsset[];
}

export interface FramedVideoBlockT {
  type: 'framed-video';
  wrapClass: string;
  vimeoId: string | null;
  source: string;
  accent: string;
  outerAspect: string;
  videoAspect: string;
  objectFit: 'cover';
  /** downloaded mp4 (when available) served from /sites/gladeye/work/<slug>/video/ */
  local?: string | null;
}

/** `work_bloks_text`; the `credits` variant is the same component with another heading. */
export interface RichTextBlockT {
  type: 'rich-text' | 'credits';
  wrapClass: string;
  heading: string;
  doc: RichNode[];
  text: string;
  headingColClass: string;
  bodyColClass: string;
}

export interface QuoteBlockT {
  type: 'quote';
  wrapClass: string;
  doc: RichNode[];
  text: string;
  attributionName: string;
  attributionTitle: string;
}

/** `work_bloks_awards` — one row per award. `url` is absent when the row has no link. */
export interface AwardsBlockT {
  type: 'awards';
  wrapClass: string;
  title: string;
  items: { award?: string; platform?: string; url?: string | null }[];
}

/**
 * `work_bloks_stats` — a big number/heading plus a description. It shares only the
 * section head with `awards`; the row shape is different, so it is its own variant
 * (`{ type:'awards' | 'stats' }` with a union-typed `items` is what made every field
 * below unreadable from the components).
 */
export interface StatsBlockT {
  type: 'stats';
  wrapClass: string;
  title: string;
  items: { heading?: string; description?: string }[];
}

/** A blok the builder recognised but the site has no renderer for. Rendered as a diagnostic. */
export interface UnsupportedBlockT {
  type: 'unsupported';
  wrapClass?: string;
  component: string;
}

export type CaseBlock =
  | ContainedMediaBlock
  | MediaPairBlock
  | MediaCarouselBlock
  | FramedVideoBlockT
  | RichTextBlockT
  | QuoteBlockT
  | AwardsBlockT
  | StatsBlockT
  | UnsupportedBlockT;

/**
 * Every `type` the block union declares — the contract `CaseBlocks.tsx` switches on and
 * the contract `scripts/verify-work-content.mjs` compares `projects.json` against. A new
 * Storyblok component has to be added here *and* handled there, or the compiler and the
 * verifier both fail.
 */
export const CASE_BLOCK_TYPES = [
  'contained-media',
  'media-pair',
  'media-carousel',
  'framed-video',
  'rich-text',
  'credits',
  'quote',
  'awards',
  'stats',
  'unsupported',
] as const;

export type CaseBlockType = (typeof CASE_BLOCK_TYPES)[number];

/** Compile-time proof the two lists above are the same set (both directions). */
type MissingFromConstList = Exclude<CaseBlock['type'], CaseBlockType>;
type ExtraInConstList = Exclude<CaseBlockType, CaseBlock['type']>;
const _blockTypesExhaustive: [MissingFromConstList, ExtraInConstList] extends [never, never] ? true : never = true;
void _blockTypesExhaustive;

/** The three media blok variants `CaseMedia.tsx` draws (used instead of a fragile `Extract`). */
export type MediaBlockT = ContainedMediaBlock | MediaPairBlock | MediaCarouselBlock;

/**
 * Anything the renderer got but cannot place — the shape `BlockDiagnostic` reads.
 * Deliberately *not* an index-signature record: every `CaseBlock` variant (all interfaces)
 * has to stay assignable to it, and interfaces do not get implicit index signatures.
 */
export interface UnknownBlock {
  type?: unknown;
  component?: unknown;
}

export interface CaseProject {
  slug: string;
  title: string;
  cmsName: string;
  theme: ThemeName;
  accent: string;
  client: { name: string; url: string | null } | null;
  category: string;
  date: string;
  tags: string[];
  visitSite: string | null;
  hero: { portrait: ImageAsset | null; landscape: ImageAsset | null; thumbnail: ImageAsset | null };
  intro: { headingDoc: RichNode[]; leadDoc: RichNode[]; metadata?: MetadataEntry[] };
  blocks: CaseBlock[];
  next: {
    slug: string;
    title: string;
    client: string;
    headingDoc: RichNode[];
    source: 'case-page-payload' | 'name-order-rule';
  } | null;
  evidence: { source: 'case-page' | 'work-payload'; blocksFromDom: boolean; topBlocks: number };
}

export interface FeaturedCard {
  slug: string;
  order: number;
  label: string;
  client: string;
  title: string;
  image: ImageAsset | null;
  multimedia: {
    kind: 'file' | 'vimeo' | 'image';
    vimeoId?: string | null;
    source?: string;
    image?: ImageAsset | null;
  } | null;
  /** the two stacked layers of the original card, in DOM order, with SSR opacity */
  layers: { opacity: number; kind: 'image' | 'video' }[];
  hoverModel: string;
  frameClass: string;
  frameRatio: number;
  raw?: unknown;
}

export interface ArchiveRow {
  slug: string;
  order: number;
  year: string;
  title: string;
  titleFromCms: string;
  client: string;
  /** accent colour of the row background that scales in on hover */
  color: string;
  /** cursor-following square preview (FeatureList_box) */
  preview: ImageAsset | null;
  viewLabel: string;
}

export interface ProjectsData {
  generatedFrom: string[];
  showreel: { vimeoId: string; title: string; playLabel: string; embedUrl: string; evidence: string };
  tags: { id: number; name: string; value: string }[];
  featuredOrder: string[];
  archiveOrder: string[];
  featured: FeaturedCard[];
  archive: ArchiveRow[];
  projects: Record<string, CaseProject>;
  diagnostics: Record<string, string[] | [string, string][]>;
}

export const THEME_VARS: Record<ThemeName, { primary: string; secondary: string; tertiary: string }> = {
  dark: { primary: '16 16 16', secondary: '255 255 255', tertiary: '255 255 255' },
  light: { primary: '255 255 255', secondary: '16 16 16', tertiary: '16 16 16' },
};

export const localImage = (asset: ImageAsset | null | undefined, slug: string) =>
  asset ? `/sites/gladeye/work/${slug}/${asset.local}` : '';

export const localFrame = (item: { frameBackground?: string }) => item.frameBackground || 'rgb(251 197 0)';

/* ------------------------------------------------------------------ helpers -- */

/**
 * Plain text of a ProseMirror doc, node by node. Used for `<meta name="description">`
 * and by the verifier; it is exhaustive over `RichNode` so a new node type cannot be
 * silently stringified as `undefined`.
 */
export function richNodeText(node: RichNode): string {
  switch (node.t) {
    case 'p':
    case 'h':
      return node.runs.map((run: RichRun) => run.text).join('');
    case 'ul':
    case 'ol':
      return node.items.map((item) => richRunsText(item.runs)).join(' ');
    case 'hr':
      return '';
    case 'inlineImage':
      return '';
    default: {
      const unhandled: never = node;
      void unhandled;
      return '';
    }
  }
}

const richRunsText = (runs: RichRun[]) => runs.map((run) => run.text).join('');

export const richDocText = (nodes: RichNode[] | null | undefined): string =>
  (nodes || []).map(richNodeText).join(' ').replace(/\s+/g, ' ').trim();

/**
 * Does this `work_bloks_video.source` point at a video *file*?
 * The captured data has two shapes: `player.vimeo.com/progressive_redirect/…file.mp4`
 * (rendered by the original as `<video src>`) and a plain `vimeo.com/<id>[/<priv>]`
 * page link, which the original hands to its Vimeo embed. Feeding the second shape to a
 * `<video>` element renders a dead player, so the renderer branches on this.
 */
export const isPlayableFileSource = (source: string | null | undefined): boolean =>
  typeof source === 'string' && (/\.mp4(\?|#|$)/.test(source) || source.includes('/progressive_redirect/'));

/** `player.vimeo.com/video/<id>` — the embed the original hydrates into for page links. */
export const vimeoPlayerSrc = (vimeoId: string | null): string | null =>
  vimeoId ? `https://player.vimeo.com/video/${vimeoId}?title=0&byline=0&portrait=0` : null;

/**
 * Work images the origin itself no longer serves. `evidence/asset-report-work.json`
 * records one 632-request run: `social-mobility-in-the-digital-age` hero-portrait
 * `cover-fall.jpg` answers 403 (S3 AccessDenied) for the original file and 404 for every
 * `/m/…` transform, and the site's own `/_next/image` proxy returns
 * `OPTIMIZED_EXTERNAL_IMAGE_REQUEST_UNAVAILABLE`. It is therefore rendered as an explicit
 * blocked frame — never as a substituted placeholder.
 */
export const BLOCKED_WORK_ASSETS: Record<string, string> = {
  '/sites/gladeye/work/social-mobility-in-the-digital-age/5118x2880-ea9564520a-cover-fall.jpg':
    'upstream 403/404 (evidence/asset-report-work.json: http-404 on /m/1920x0, 403 AccessDenied on the source file)',
};

export const blockedWorkAsset = (publicPath: string | null | undefined): string | null =>
  publicPath ? BLOCKED_WORK_ASSETS[publicPath] ?? null : null;
