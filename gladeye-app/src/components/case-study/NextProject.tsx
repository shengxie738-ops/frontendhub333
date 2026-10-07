import { Button } from '@/components/shell/Button';

import RichInline from './RichInline';

import type { CaseProject } from '@/content/schema';

/**
 * The "Up Next" card. From the tail of `evidence/source-pages/_work_cyberbrokers.html`:
 *
 *   <div style="--theme-primary:16 16 16;--theme-secondary:255 255 255;--theme-tertiary:255 255 255"
 *        class="bg-theme-primary py-10 text-theme-secondary">
 *     <div class="ui-grid mx-auto h-[320px] max-w-site grid-rows-[auto,_1fr] items-end gap-y-4 sm:h-[420px]">
 *       <div class="col-span-full"><h3 class="t-p-md font-medium">Up Next</h3></div>
 *       <div class="col-span-full space-y-4 lg:col-span-15"><h3 class="t-meta">{client}</h3><h4 class="t-h2">{title}</h4></div>
 *       <div class="col-span-full space-y-8 pb-2 lg:col-span-9 lg:space-y-6"><h4 class="t-p-md">{deck}</h4>
 *         <a class="Button_main__NewW7 Button_default__CcbQU Button_ghost__gZqlA" href="/work/{slug}">Next Project</a>
 *
 * The inline variables are in the captured HTML: the block is always the dark theme, no
 * matter what the project above it uses. The successor itself comes from
 * `project.next`, which `build-work-data.mjs` took from each case page's own
 * `nextStory` payload (14/14 verified) or from the name-order rule it validated against
 * those 14.
 */
export function NextProject({ next }: { next: CaseProject['next'] }) {
  if (!next) return null;
  return (
    <div
      style={{
        ['--theme-primary' as string]: '16 16 16',
        ['--theme-secondary' as string]: '255 255 255',
        ['--theme-tertiary' as string]: '255 255 255',
      }}
      className="bg-theme-primary py-10 text-theme-secondary"
    >
      <div className="ui-grid mx-auto h-[320px] max-w-site grid-rows-[auto,_1fr] items-end gap-y-4 sm:h-[420px]">
        <div className="col-span-full">
          <h3 className="t-p-md font-medium">Up Next</h3>
        </div>
        <div className="col-span-full space-y-4 lg:col-span-15">
          {next.client ? <h3 className="t-meta">{next.client}</h3> : null}
          <h4 className="t-h2">{next.title}</h4>
        </div>
        <div className="col-span-full space-y-8 pb-2 lg:col-span-9 lg:space-y-6">
          {next.headingDoc.length ? <h4 className="t-p-md">{<RichInline nodes={next.headingDoc} />}</h4> : null}
          <Button link={`/work/${next.slug}`} ghost>
            Next Project
          </Button>
        </div>
      </div>
    </div>
  );
}

export default NextProject;
