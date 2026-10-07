'use client';

import { useState } from 'react';

import FeaturedWorkGrid from './FeaturedWorkGrid';
import ThemeSection from './ThemeSection';
import ThemeShell from './ThemeShell';
import WorkArchive from './WorkArchive';
import WorkShowreel from './WorkShowreel';
import { projects } from './data';

/**
 * `/work`, section for section, from `evidence/source-pages/_work.html` and the page
 * chunk `evidence/source-assets/js/app/work/page-8e3968f3d61178f4.js` (module 1959 `z`):
 *
 *   <div class="relative z-main bg-theme-primary transition-bg duration-theme">
 *     <Section theme="light"><div class="mx-auto pt-32"     style="max-width:2000px">FeaturedWorkGrid
 *     <Section theme="light"><div class="mx-auto  md:py-32" style="max-width:2000px">Video3d (showreel)
 *     <Section theme="light"><div class="mx-auto  pb-xl-40" style="max-width:2000px">FeatureList (archive)
 *
 * All three sections are `data-theme="light"` in the capture, which is why the page is
 * white end to end — the header still inverts because each Section pushes its theme into
 * the shared ThemeProvider as it crosses the middle of the viewport.
 *
 * `fadeToMute` reproduces the original's `onVisible` wiring: the showreel un-mutes while
 * it owns the viewport and mutes when either neighbour takes over.
 */
export function WorkPage() {
  const [fadeToMute, setFadeToMute] = useState(true);

  return (
    <ThemeShell initialTheme="light">
      <ThemeSection theme="light" onVisible={() => setFadeToMute(true)}>
        <div className="mx-auto pt-32" style={{ maxWidth: '2000px' }}>
          <FeaturedWorkGrid cards={projects.featured} />
        </div>
      </ThemeSection>

      <ThemeSection theme="light" onVisible={() => setFadeToMute(false)}>
        <div className="mx-auto  md:py-32" style={{ maxWidth: '2000px' }}>
          <WorkShowreel fadeToMute={fadeToMute} />
        </div>
      </ThemeSection>

      <ThemeSection theme="light" onVisible={() => setFadeToMute(true)}>
        <div className="mx-auto  pb-xl-40" style={{ maxWidth: '2000px' }}>
          <WorkArchive rows={projects.archive} />
        </div>
      </ThemeSection>
    </ThemeShell>
  );
}

export default WorkPage;
