import type { Metadata } from 'next';
import CareersPageView from '@/components/careers/CareersPage';
import careers from '@/content/careers.json';
import type { CareersPage as CareersPageData } from '@/content/pages-schema';

const data = careers as unknown as CareersPageData;

/** Frozen seo block: title "Job Opportunities at Gladeye", id d5128636-…. */
export const metadata: Metadata = {
  title: `${data.seo.title} - Gladeye`,
  description: data.seo.description,
};

/**
 * /careers — `data-theme="dark"` (#101010 / #FFFFFF).
 * The shell supplies the header and the yellow footer; this route owns only the
 * page content container, matching the frozen `z-main bg-theme-primary` wrapper.
 */
export default function Page() {
  return (
    <div data-theme={data.theme} className='relative z-main bg-theme-primary transition-bg duration-theme'>
      <CareersPageView />
    </div>
  );
}
