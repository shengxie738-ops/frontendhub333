import contact from '@/content/contact.json';
import type { ContactPage as ContactPageData, ContactBlock } from '@/content/pages-schema';
import { GreetingMarquee } from './GreetingMarquee';

const data = contact as unknown as ContactPageData;

/**
 * MotionLink: the source duplicates every label into two stacked spans and
 * rolls them vertically on hover. Both class names and the two-span structure
 * are the shipped ones (`0b3a3a603128fa66.css`).
 */
function MotionLink({ item, interactive }: { item: ContactBlock['items'][number]; interactive: boolean }) {
  return (
    <a
      className={`MotionLink_main__kgq4W${interactive ? ' pointer-events-auto' : ''}`}
      href={item.href}
      {...(item.target ? { target: item.target } : {})}
      {...(item.rel ? { rel: item.rel } : {})}
    >
      <div className='MotionLink_inner__hsBoJ'>
        <span>{item.label}</span>
        <span>{item.label}</span>
      </div>
    </a>
  );
}

function ContactGroup({ group, interactive }: { group: ContactBlock; interactive: boolean }) {
  return (
    <div>
      <h3 className='font-light'>{group.heading}</h3>
      <ul className='flex items-center info-gap-2 font-medium'>
        {group.items.map((item, i) => (
          <li key={`${item.href}-${i}`} className='flex items-center info-gap-2'>
            <MotionLink item={item} interactive={interactive} />
            {item.separator ? <span className='font-light'>{item.separator}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * /contact.
 *
 * Frozen DOM shape (`evidence/source-pages/_contact.html`), reproduced node for
 * node. Note three things that a generic template would get wrong:
 *
 *  1. `data-theme="yellow"` — #FBC500 background with #000000 text. Not a dark
 *     page. `--theme-*` triplets come from the site's own Tailwind palette.
 *  2. The page is a single `min-h-screen` flex column with `md:justify-between`,
 *     so the greeting band sits at the top and the contact block is pushed to
 *     the bottom of the first screen.
 *  3. This section's own copyright reads `© Gladeye 2023`. Contact suppresses
 *     the shared newsletter/footer: the captured page chunk does so on mount,
 *     and current live DOM at 1180×757 confirmed no footer or Subscribe text.
 *
 * There is no form on this route. The existing business links remain anchors;
 * this component does not post, fetch, or send mail. The physics layer below
 * remains an explicitly pending placeholder, not a completed reproduction.
 */
export default function ContactPageView() {
  const groups = data.blocks.groups;

  return (
    <section data-theme={data.theme} className='text-theme-secondary transition-colors duration-theme'>
      <div className='border-1 flex info-min-h-screen flex-col info-pb-8 pt-Header-height md:justify-between'>
        {/*
          The frozen page also mounts a full-viewport canvas here:
            <div class="fixed inset-0 z-20"><canvas class="h-full w-full"></canvas></div>
          Current live evidence and captured module 1385 show draggable wave
          sprites driven by Matter physics. That implementation is pending and
          outside this slice. This inert, transparent pointer-events:none
          placeholder preserves the existing layer without claiming the
          physics, canvas dimensions, or sprite behavior are complete.
        */}
        <div className='fixed inset-0 z-20 pointer-events-none' aria-hidden='true'>
          <canvas className='h-full w-full' />
        </div>

        <GreetingMarquee greetings={data.greetings} />

        <div className='pointer-events-none relative z-30 info-space-y-8 px-sms'>
          {/* `data.intro.className` is the shipped class list, used verbatim —
              none of those five names collide with stock Tailwind. */}
          <p className={data.intro.className}>{data.intro.text}</p>

          {/* `data.blocks.wrapperClass` records the original
              "t-contact-meta space-y-6"; `space-y-6` is re-pointed at the
              site's clamp() ruler via the prefixed token. */}
          <div className='t-contact-meta info-space-y-6'>
            <ContactGroup group={groups[0]} interactive />
            <ContactGroup group={groups[1]} interactive />
            <ContactGroup group={groups[2]} interactive />
            <p>{data.copyrightInPage.text}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
