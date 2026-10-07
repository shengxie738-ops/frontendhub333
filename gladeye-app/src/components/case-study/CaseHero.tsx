import CaseImage from './CaseImage';
import Reveal from './Reveal';
import { workAsset } from '@/components/work/data';

import type { CaseProject } from '@/content/schema';

/**
 * Case-study hero + title bar, reproduced from `evidence/source-pages/_work_cyberbrokers.html`
 * (identical wrapper markup in all 14 captured case pages):
 *
 *   <section data-theme="{project.theme}">
 *     <div class="relative h-screen overflow-hidden">
 *       <div class="absolute inset-0 z-10"><div class="w-full h-full">
 *         <div class="absolute inset-0 h-full w-full"><div class="h-full w-full landscape:hidden" style="background:#000000">
 *           <div style="opacity:0"> …portrait asset, cover-fit… </div></div></div>
 *         <div class="absolute inset-0 h-full w-full"><div class="h-full w-full portrait:hidden" style="background:#000000">
 *           <div style="opacity:0"> …landscape asset… </div></div></div>
 *       </div></div>
 *       <div class="absolute inset-x-0 bottom-0 z-20"><div class="flex h-xl-60 items-end bg-gradient-to-t
 *            from-theme-primary px-sms pb-xl-12"><div class="overflow-hidden"><h1 class="t-p-md …">…</h1>
 *
 * Orientation, not viewport width, picks the asset — that is what `landscape:hidden` /
 * `portrait:hidden` do (see `src/components/work/tokens.css`).
 */
export function CaseHero({ project }: { project: CaseProject }) {
  const portrait = workAsset(project.slug, project.hero.portrait);
  const landscape = workAsset(project.slug, project.hero.landscape);

  return (
    <div className="relative h-screen overflow-hidden">
      <div className="absolute inset-0 z-10">
        <div className="w-full h-full" style={{ transform: 'none' }}>
          <div className="absolute inset-0 h-full w-full" style={{ transform: 'none' }}>
            <div className="h-full w-full landscape:hidden" style={{ background: '#000000' }}>
              {portrait ? (
                <Reveal offsetY={null} duration={750} className="h-full w-full">
                  <CaseImage asset={project.hero.portrait} src={portrait} sizes="100vw" priority />
                </Reveal>
              ) : null}
            </div>
          </div>
          <div className="absolute inset-0 h-full w-full" style={{ transform: 'none' }}>
            <div className="h-full w-full portrait:hidden" style={{ background: '#000000' }}>
              {landscape ? (
                <Reveal offsetY={null} duration={750} className="h-full w-full">
                  <CaseImage asset={project.hero.landscape} src={landscape} sizes="100vw" priority />
                </Reveal>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20">
        <div className="flex h-xl-60 items-end bg-gradient-to-t from-theme-primary px-sms pb-xl-12">
          <div className="overflow-hidden">
            <Reveal as="h1" className="t-p-md text-theme-secondary" duration={600}>
              {project.title}
            </Reveal>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CaseHero;
