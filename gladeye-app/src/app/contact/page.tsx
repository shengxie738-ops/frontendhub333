import type { Metadata } from 'next';
import ContactPageView from '@/components/contact/ContactPage';
import contact from '@/content/contact.json';
import type { ContactPage as ContactPageData } from '@/content/pages-schema';

const data = contact as unknown as ContactPageData;

/** Verbatim from the frozen Storyblok `seo` block for the Contact entry. */
export const metadata: Metadata = {
  title: `${data.seo.title} - Gladeye`,
  description: data.seo.description,
};

/**
 * /contact — one screen, `data-theme="yellow"`.
 *
 * Nothing on this route submits, fetches or sends. `mailto:` links are left as
 * plain anchors (the browser handles them); no network call is made to the
 * origin site, and there is no form markup on this page at all.
 */
export default function Page() {
  return (
    <div data-theme={data.theme} className='relative z-main bg-theme-primary transition-bg duration-theme'>
      <ContactPageView />
    </div>
  );
}
