import type { Metadata } from 'next';

import WorkPage from '@/components/work/WorkPage';

/* The original's component CSS (kept under its own `__hash` class names) plus the
   verbatim design tokens it needs. Both are global; they are imported only by /work
   routes so they cannot disturb another builder's page. */
import '@/components/work/tokens.css';
import '@/components/work/original-classes.css';

/**
 * `<title>` and `<meta name="description">` copied from
 * `evidence/source-pages/_work.html`.
 */
export const metadata: Metadata = {
  title: "Gladeye's Project Showcase - Gladeye",
  description:
    "Explore Gladeye's diverse portfolio of groundbreaking digital projects. From HuffPost to CyberBrokers, Rolling Stone to Bombas,  innovation meets creativity across websites, digital storytelling, products and experiences.",
  alternates: { canonical: '/work' },
};

export default function Page() {
  return <WorkPage />;
}
