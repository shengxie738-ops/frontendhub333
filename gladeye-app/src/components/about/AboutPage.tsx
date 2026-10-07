import about from '@/content/about.json';
import type {
  AboutAwardsSection,
  AboutCareersSection,
  AboutContentSection,
  AboutPage as AboutPageData,
  AboutServicesSection,
  InlineNode,
} from '@/content/pages-schema';
import { RichInline, RichColumn } from './RichInline';
import { BlurImage } from './BlurImage';
import { ArrowUpRightIcon } from './InfoIcons';
import styles from './about.module.css';

const data = about as unknown as AboutPageData;

/* Award groups whose CMS link is an unresolved internal `story` link render as
   plain text on the original site (no <a>, no arrow). Recorded as `href: ""`. */
const isLiveLink = (href: string) => href.length > 0;

/** `(216)` — the frozen total. React SSR inserts the same `<!-- -->` text
    separators between the three children that the original HTML shows. */
function CountParen({ n }: { n: string }) {
  return <span className='t-team-meta'>({n})</span>;
}

function nodesToText(nodes: InlineNode[]) {
  return nodes.map((n) => (n.t === 'br' ? '\n' : n.v)).join('');
}

/* ==================================================================== *
 * 1. Hero — `data-theme="green"`, full-bleed photo, `t-d2` heading pinned
 *    to the bottom of the viewport. The source ships TWO heading layouts
 *    (`heading` at >=768px, `heading_compact` below) and TWO image layouts
 *    (`landscape:hidden` / `portrait:hidden`), both reproduced.
 * ==================================================================== */
function Hero() {
  const h = data.hero;
  return (
    <section data-theme={h.theme} className='text-theme-secondary transition-colors duration-theme'>
      <div className='relative h-screen overflow-hidden'>
        <div className='absolute inset-0 z-10'>
          <div className='w-full h-full' style={{ transform: 'none' }}>
            <div className='absolute inset-0 h-full w-full' style={{ transform: 'none' }}>
              <div className='h-full w-full landscape:hidden' style={{ background: '#000000' }}>
                <div className={styles.revealLayer}>
                  <BlurImage page='about' filename={h.image.filename} alt={h.image.alt} eager />
                </div>
              </div>
            </div>
            <div className='absolute inset-0 h-full w-full' style={{ transform: 'none' }}>
              <div className='h-full w-full portrait:hidden' style={{ background: '#000000' }}>
                <div className={styles.revealLayer}>
                  <BlurImage
                    page='about'
                    filename={h.imagePortrait.filename}
                    alt={h.imagePortrait.alt}
                    eager
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className='absolute inset-x-0 bottom-0 z-20 mx-auto max-w-site px-sms pb-xl-20'>
          {/* desktop heading */}
          <div className='-mb-[0.5em] hidden overflow-hidden pb-[0.5em] md:block'>
            <h1 className='t-d2 indent-20'>
              <RichInline nodes={h.heading} />
            </h1>
          </div>
          {/* compact heading below 768px — different breaks AND different italics */}
          <div className='overflow-hidden md:hidden'>
            <h1 className='t-d2'>
              <RichInline nodes={h.headingCompact} />
            </h1>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ==================================================================== *
 * 2. `page_bloks_content` — "Who we are" and "Our process".
 *    Grid: label in lg:6 / xl:10 columns, body in lg:18 / xl:14.
 *    Body copy is `t-p-md` flowed into two CSS columns from 640px up.
 *    "Our process" additionally leads with two square `bg-yellow` photo
 *    cells that span the full grid, ABOVE the heading.
 * ==================================================================== */
function ContentSection({ s }: { s: AboutContentSection }) {
  return (
    <section data-theme={s.theme} className='text-theme-secondary transition-colors duration-theme'>
      <div className='mx-auto max-w-site'>
        <div className='ui-grid gap-y-s-8 sm:gap-y-xl-20'>
          {s.media.length > 0 && (
            <div className='col-span-full grid grid-cols-2 gap-sgs'>
              {s.media.map((m, i) => (
                <div key={m._uid ?? i} className='col-span-1 aspect-square bg-yellow'>
                  <div className={styles.revealLayer}>
                    <BlurImage page='about' filename={m.filename} alt={m.alt} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className='col-span-full lg:col-span-6 xl:col-span-10'>
            <h2 className='t-p-md font-medium'>{s.heading}</h2>
          </div>

          <div className='col-span-full lg:col-span-18 xl:col-span-14'>
            <div className='space-y-lg-20'>
              <div className='info-space-y-20'>
                <h3 className='t-h3 indent-20 font-light'>
                  <RichInline nodes={s.lead} />
                </h3>
              </div>
              <div className='rich-text t-p-md gap-x-sgs info-space-y-8 sm:columns-2'>
                {s.columns
                  .filter((nodes) => nodes.length > 0)
                  .map((nodes, i) => (
                    <p key={i} className='break-inside-avoid-column'>
                      <RichColumn nodes={nodes} />
                    </p>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ==================================================================== *
 * 3. `page_bloks_definition_list` — "Our services".
 *    Not a card grid. A 2-column definition list: term in col 1, its bullet
 *    list in col 2, on a 4-col/2-col nested grid with `sgs` gutters.
 * ==================================================================== */
function ServicesSection({ s }: { s: AboutServicesSection }) {
  return (
    <section data-theme={s.theme} className='text-theme-secondary transition-colors duration-theme'>
      <div className='mx-auto max-w-site'>
        <div className='ui-grid gap-y-s-8 sm:gap-y-xl-20'>
          <div className='col-span-full h-px bg-theme-secondary/20' />

          <div className='col-span-full lg:col-span-6 xl:col-span-10'>
            <h2 className='t-p-md font-medium'>{s.heading}</h2>
          </div>

          <div className='col-span-full lg:col-span-18 xl:col-span-14'>
            <div className='grid grid-cols-2 items-start gap-x-sgs gap-y-s-6 md:info-gap-y-10'>
              {s.groups.map((g) => (
                <div
                  key={g._uid}
                  className='col-span-full grid grid-cols-4 gap-x-sgs gap-y-s-4 sm:col-span-1 sm:grid-cols-2'
                >
                  <h3 className='col-span-full sm:col-span-1'>
                    {/* heading text is verbatim, trailing space included */}
                    <span className='t-p font-medium text-theme-tertiary'>{g.heading}</span>
                  </h3>
                  <div className='col-span-3 col-start-2 sm:col-span-1'>
                    <div className='rich-text t-p'>
                      <ul>
                        {g.items.map((item, i) => (
                          <li key={i}>
                            <p>{item}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ==================================================================== *
 * 4. `page_bloks_awards` — frozen 216 total across 28 organisations.
 *    Header row `t-h2` + `( 216 )` in `t-team-meta`, then one
 *    `border-t border-theme-secondary/40 py-6` grid row per organisation:
 *    name in col 6/12, then `quantity / name` pairs in a 6-col→12-col grid.
 *    Numbers and years are the frozen 2024-10-10 values, deliberately not
 *    refreshed.
 * ==================================================================== */
function AwardsSection({ s }: { s: AboutAwardsSection }) {
  return (
    <section data-theme={s.theme} className='text-theme-secondary transition-colors duration-theme'>
      <div className='mx-auto max-w-site'>
        <div className='mb-xl-16 flex px-sms text-theme-tertiary'>
          <h2 className='t-h2'>{s.heading}</h2>
          <CountParen n={s.countLabel} />
        </div>

        <div className='px-sms'>
          {s.groups.map((g) => (
            <div
              key={g._uid}
              className='ui-grid border-t border-theme-secondary/40 px-0 info-py-6'
            >
              <div className='col-span-6 lg:col-span-12'>
                <h3 className='t-list'>
                  {isLiveLink(g.href) ? (
                    <div className='inline-flex pr-[1em]'>
                      <a className='ui-link' href={g.href} target='_blank' rel='noopener noreferrer'>
                        <span className='relative'>
                          <span>{g.type}</span>
                          <span className='absolute -right-[1em] bottom-[0.5em] h-[0.5em] w-[0.5em]'>
                            <ArrowUpRightIcon />
                          </span>
                        </span>
                      </a>
                    </div>
                  ) : (
                    g.type
                  )}
                </h3>
              </div>

              <div className='col-span-6 info-space-y-4 font-normal lg:col-span-12'>
                {g.items.map((it) => (
                  <div key={it._uid} className='grid grid-cols-6 gap-sgs lg:grid-cols-12'>
                    <h4 className='t-list col-span-1 lg:col-span-4'>{it.quantity}</h4>
                    <h5 className='t-list col-span-5 lg:col-span-8'>{it.name}</h5>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ==================================================================== *
 * 5. `page_bloks_careers` — "Join the family".
 *    The frozen payload has `careers: []`, so the original emits an EMPTY
 *    `<section data-theme="green">`. Reproduced exactly; no roles invented.
 * ==================================================================== */
function CareersSection({ s }: { s: AboutCareersSection }) {
  return (
    <section
      data-theme={s.theme}
      className='text-theme-secondary transition-colors duration-theme'
      aria-label={s.heading}
    >
      {s.roles.length > 0 ? (
        <div className='mx-auto max-w-site'>
          <div className='ui-grid'>
            <div className='col-span-full'>
              <h2 className='t-p-md font-medium'>{s.heading}</h2>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default function AboutPageView() {
  return (
    <>
      <Hero />
      <div className='space-y-xl-40 py-xl-40'>
        {data.sections.map((s) => {
          switch (s.component) {
            case 'page_bloks_content':
              return <ContentSection key={s._uid} s={s} />;
            case 'page_bloks_definition_list':
              return <ServicesSection key={s._uid} s={s} />;
            case 'page_bloks_awards':
              return <AwardsSection key={s._uid} s={s} />;
            case 'page_bloks_careers':
              return <CareersSection key={s._uid} s={s} />;
            default:
              return null;
          }
        })}
      </div>
    </>
  );
}

export { nodesToText };
