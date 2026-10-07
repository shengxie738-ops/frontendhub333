import type { Metadata } from 'next';
import AboutPageView from '@/components/about/AboutPage';
import { ThemeStage } from '@/components/about/ThemeStage';
import about from '@/content/about.json';

/** Title and description are the frozen Storyblok `seo` block, verbatim. */
export const metadata: Metadata = {
  title: 'About Gladeye - Gladeye',
  description: (about as { seo: { description: string } }).seo.description.trim(),
};

/**
 * /about.
 *
 * The shell (`layout.tsx`, owned by another builder) supplies the fixed header
 * and the yellow footer. This route renders the page's own content container,
 * which on the original site is
 *   <div class="relative z-main bg-theme-primary transition-bg duration-theme">
 * inside <main class="bg-black">. The container is the thing that paints, and
 * the original repaints its `data-theme` from an IntersectionObserver as the
 * sections scroll past the viewport middle — which is why "Our process" and
 * "Awards" read black while everything above them reads green. `ThemeStage`
 * reproduces that; `hero.theme` (`green`) is its starting value, matching the
 * frozen DOM at scroll 0.
 */
export default function Page() {
  const heroTheme = (about as { hero: { theme: string } }).hero.theme;
  return (
    <ThemeStage
      initialTheme={heroTheme}
      className='relative z-main bg-theme-primary transition-bg duration-theme'
    >
      <AboutPageView />
    </ThemeStage>
  );
}
