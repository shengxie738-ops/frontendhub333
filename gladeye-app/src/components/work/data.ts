/**
 * Typed access to the work content built by `scripts/build-work-data.mjs`.
 *
 * Nothing is re-derived here: `src/content/projects.json` is the single source of
 * truth (order, labels, colours, block sequences all come from the captured DOM),
 * and `src/content/schema.ts` describes it. This module only adds the two things the
 * components need on top — a cast and the local asset path helper.
 */
import projectsJson from '@/content/projects.json';
import { BLOCKED_WORK_ASSETS } from '@/content/schema';

import type { ArchiveRow, CaseProject, FeaturedCard, ImageAsset, ProjectsData } from '@/content/schema';

export const projects = projectsJson as unknown as ProjectsData;

/** `/sites/gladeye/work/<slug>/<file>` — the path `asset-manifest.json` wrote the file to. */
export const workAsset = (slug: string, asset: ImageAsset | null | undefined): string | null =>
  asset ? `/sites/gladeye/work/${slug}/${asset.local}` : null;

/**
 * The set of images that actually landed in `public/` is audited by
 * `scripts/verify-work-content.mjs`. One Storyblok asset is gone upstream
 * (`social-mobility-in-the-digital-age` hero-portrait `cover-fall.jpg` — 403 AccessDenied
 * on the source file, 404 on every `/m/` transform, and the origin's own image proxy
 * answers OPTIMIZED_EXTERNAL_IMAGE_REQUEST_UNAVAILABLE), so `CaseImage` paints a labelled
 * blocked frame for it instead of a placeholder. The registry lives in
 * `src/content/schema.ts` beside the evidence note and is mirrored here under the name the
 * work components already import.
 */
export const MISSING_UPSTREAM: Record<string, boolean> = Object.fromEntries(
  Object.keys(BLOCKED_WORK_ASSETS).map((publicPath) => [publicPath, true]),
);

export const caseProject = (slug: string): CaseProject | undefined => projects.projects[slug];

export const featuredCards = (): FeaturedCard[] => projects.featured;
export const archiveRows = (): ArchiveRow[] => projects.archive;

/** Every slug the case-study route can serve (42 = 34 archive + 8 featured-only). */
export const allSlugs = (): string[] => Object.keys(projects.projects);

/** The `next` chain, so a case page can render its own successor rather than a shared one. */
export const nextOf = (slug: string) => projects.projects[slug]?.next ?? null;
