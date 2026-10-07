import { notFound } from 'next/navigation';

import BlockRenderer from './CaseBlocks';
import CaseHero from './CaseHero';
import CaseIntro from './CaseIntro';
import NextProject from './NextProject';
import ThemeSection from '@/components/work/ThemeSection';
import ThemeShell from '@/components/work/ThemeShell';
import { projects } from '@/components/work/data';

/**
 * `/work/[slug]` — one case study, assembled entirely from that project's own record in
 * `src/content/projects.json`. Nothing here is shared between two slugs: the theme, the
 * accent that paints every media frame, the intro, the block sequence and the successor
 * are all per-project fields, so 42 routes render 42 different pages.
 *
 * Section map, from `evidence/source-pages/_work_cyberbrokers.html` (and the 13 other
 * captured case pages, which agree):
 *
 *   <section data-theme="{project.theme}">   hero (h-screen, orientation-swapped cover)
 *                                            + masthead (t-d3 heading, Visit Site, lead,
 *                                              Client / Category / Date)
 *   <section data-theme="light">             <div class="WrokBloks_main__IqYqU"> blocks…
 *                                            + the dark "Up Next" panel
 *
 * The body section is `light` on every captured page, including the one project whose own
 * theme is `light` (the-dj-and-the-war-crimes → `light,light`), so it is hard-coded rather
 * than derived.
 */
export function CaseStudy({ slug }: { slug: string }) {
  const project = projects.projects[slug];
  if (!project) notFound();

  const nextProject = project.next ? projects.projects[project.next.slug] : undefined;
  const nextPayload = project.next
    ? {
        ...project.next,
        title: nextProject?.title ?? project.next.title,
        client: nextProject?.client?.name || project.next.client,
        headingDoc: nextProject?.intro.headingDoc ?? project.next.headingDoc,
      }
    : null;

  return (
    <ThemeShell initialTheme={project.theme}>
      <ThemeSection theme={project.theme}>
        <CaseHero project={project} />
        <CaseIntro project={project} />
      </ThemeSection>

      <ThemeSection theme="light">
        <div className="WrokBloks_main__IqYqU">
          {project.blocks.map((block, index) => (
            <BlockRenderer
              key={`${block.type}-${index}`}
              block={block}
              slug={project.slug}
              accent={project.accent}
              index={index}
            />
          ))}
        </div>
        <NextProject next={nextPayload} />
      </ThemeSection>
    </ThemeShell>
  );
}

export default CaseStudy;
