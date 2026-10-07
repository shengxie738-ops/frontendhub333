import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CaseStudy } from '@/components/case-study/CaseStudy';
import { allSlugs, projects } from '@/components/work/data';
import { richDocText } from '@/content/schema';

import '@/components/work/tokens.css';
import '@/components/work/original-classes.css';

/**
 * Every case study in `src/content/projects.json` is prerendered — that is all 42
 * projects the /work payload resolves (34 archive rows + 8 featured cards), which is a
 * superset of the 14 case pages captured in `evidence/source-pages/` and of the 14 URLs
 * listed in `evidence/route-inventory.json`. The remaining 28 are built from the same
 * Storyblok payload the /work page embedded (`evidence.source === 'work-payload'`), so
 * their blocks are ordered by the CMS rather than verified against a rendered DOM; each
 * project carries that provenance in its own `evidence` field.
 */
export function generateStaticParams() {
  return allSlugs().map((slug) => ({ slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const project = projects.projects[params.slug];
  if (!project) return {};
  // `leadDoc` is a RichNode[] — its first node can be a list / heading / rule, not only a
  // paragraph, so the text is flattened by the schema's exhaustive reader instead of
  // reaching for `.runs` on whatever happens to come first.
  const lead = richDocText(project.intro.leadDoc).slice(0, 200);
  return {
    title: `${project.title.trim()} - Gladeye`,
    description: lead || `${project.category} — ${project.client?.name ?? 'Gladeye'}`,
    alternates: { canonical: `/work/${project.slug}` },
    openGraph: {
      title: `${project.title.trim()} ${project.category} - Gladeye`,
      images: project.hero.landscape ? [{ url: project.hero.landscape.src }] : [],
    },
  };
}

export default function Page({ params }: { params: { slug: string } }) {
  if (!projects.projects[params.slug]) notFound();
  return <CaseStudy slug={params.slug} />;
}
