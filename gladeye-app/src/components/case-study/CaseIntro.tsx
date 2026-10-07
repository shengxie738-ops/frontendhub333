import { ArrowRightUp } from '@/components/shared/icons';
import { Button } from '@/components/shell/Button';

import Reveal from './Reveal';
import RichInline from './RichInline';
import RichText from './RichText';

import type { CaseProject, MetadataEntry } from '@/content/schema';

/**
 * The case-study masthead, taken verbatim from the captured DOM of the 14 evidenced
 * case pages (all 14 are structurally identical — verified by grepping
 * `evidence/source-pages/_work_*.html` for `t-d3 indent-20`, `h-xl-60`, `Visit Site`):
 *
 *   <div class="mx-auto max-w-site">
 *     <div class="ui-grid gap-y-8 border-b border-theme-secondary/20 py-10 md:py-20">
 *       <div class="col-span-full -mb-[0.5em] overflow-hidden pb-[0.5em] lg:col-span-17"><h2 class="t-d3 indent-20">…
 *       <div class="col-span-full lg:col-span-7 lg:justify-self-end"><div class="flex flex-col items-start gap-y-4">
 *            <a class="Button_main__NewW7 Button_default__CcbQU" target="_blank" …>Visit Site</a>
 *     <div class="ui-grid gap-y-8 py-10 md:py-20 xl:py-28">
 *       <div class="col-span-full lg:col-span-17 xl:col-span-12"><div class="rich-text t-p-lg max-w-xl space-y-8">…
 *       <div class="col-span-full lg:col-span-17 xl:col-span-12"><div class="grid grid-cols-12 gap-x-sgs gap-y-xl-8">
 *            Client / Category / Date  (h3.t-p.font-semibold + h4)
 *
 * `projects.json` stores client / category / date as first-class fields (the builder read
 * them off the same Storyblok `meta_*` fields the original renders), so the metadata grid
 * is assembled here rather than duplicated into the JSON.
 */
export function CaseIntro({ project }: { project: CaseProject }) {
  const entries: MetadataEntry[] = [
    { label: 'Client', value: project.client?.name || '', href: project.client?.url || null },
    { label: 'Category', value: project.category || '' },
    { label: 'Date', value: project.date || '' },
  ].filter((e) => e.value.length > 0);

  return (
    <div className="mx-auto max-w-site">
      <div className="ui-grid gap-y-8 border-b border-theme-secondary/20 py-10 md:py-20">
        <div className="col-span-full -mb-[0.5em] overflow-hidden pb-[0.5em] lg:col-span-17">
          <Reveal as="h2" className="t-d3 indent-20" duration={600}>
            <RichInline nodes={project.intro.headingDoc} />
          </Reveal>
        </div>
        <div className="col-span-full lg:col-span-7 lg:justify-self-end">
          <div className="flex flex-col items-start gap-y-4">
            {project.visitSite ? (
              <Button link={project.visitSite} target="_blank" rel="nofollow noopener">
                Visit Site
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="ui-grid gap-y-8 py-10 md:py-20 xl:py-28">
        {project.intro.leadDoc.length ? (
          <div className="col-span-full lg:col-span-17 xl:col-span-12">
            <RichText nodes={project.intro.leadDoc} className="t-p-lg max-w-xl space-y-8" />
          </div>
        ) : null}

        {entries.length ? (
          <div className="col-span-full lg:col-span-17 xl:col-span-12">
            <div className="grid grid-cols-12 gap-x-sgs gap-y-xl-8">
              {entries.map((entry) => (
                <div key={entry.label} className="col-span-full space-y-1.5 md:col-span-4">
                  <h3 className="t-p font-semibold">{entry.label}</h3>
                  <h4>
                    {entry.href ? (
                      <span className="inline-flex pr-[1em]">
                        <a className="ui-link" target="_blank" rel="nofollow noopener" href={entry.href}>
                          <span className="relative">
                            <span>{entry.value}</span>
                            <span className="absolute -right-[1em] bottom-[0.5em] h-[0.5em] w-[0.5em]">
                              <ArrowRightUp className="fill-current" />
                            </span>
                          </span>
                        </a>
                      </span>
                    ) : (
                      entry.value
                    )}
                  </h4>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default CaseIntro;
