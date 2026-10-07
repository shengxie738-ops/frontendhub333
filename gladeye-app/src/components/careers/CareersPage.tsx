import careers from '@/content/careers.json';
import type { CareersPage as CareersPageData, CareersRoleRow } from '@/content/pages-schema';
import { RichColumn, RichInline } from '@/components/about/RichInline';
import { ArrowRightIcon } from '@/components/about/InfoIcons';
import { CareersImagesMarquee } from './CareersImagesMarquee';

const data = careers as unknown as CareersPageData;

/**
 * The `FeatureList` row group — verbatim from `9a7eb02b3db9aeb7.css`.
 *
 * Header is `<h2 class="t-h2">Current roles</h2>` plus the count in
 * `t-team-meta` wrapped in parentheses, exactly as the frozen DOM renders it:
 * `(<!-- -->1<!-- -->)` — React's own text-node separators, i.e. visible `(1)`.
 *
 * Each role is one row: a 24-column grid at lg (12 below) carrying location,
 * title and a ghost Button pill. Rows are anchors, not cards.
 *
 * The source data has exactly ONE open role (Digital Designer, Auckland). That
 * is the frozen truth — no additional roles, salaries or application steps have
 * been invented. The target `/careers/digital-designer` is a separate Storyblok
 * entry that the evidence bundle never captured, so the link is preserved as-is
 * and its page is out of scope for this builder.
 */
function RoleRow({ role }: { role: CareersRoleRow }) {
  return (
    <a className='FeatureList_item__3Uvy5 FeatureList_simple__0xQ_b' href={role.href}>
      <div className='FeatureList_item-inner__rl_Xr'>
        <div className='FeatureList_item-border-top__VoQoY' />

        <div className='col-span-3 hidden sm:block lg:col-span-4'>
          <h3 className='t-list'>{role.location}</h3>
        </div>

        <div className='col-span-10 sm:col-span-5 lg:col-span-12'>
          <h4 className='t-h5'>{role.title}</h4>
        </div>

        <div className='col-span-2 flex items-center justify-end gap-x-sgs sm:col-span-4 lg:col-span-8 lg:justify-between'>
          <h5 className='t-list hidden lg:block'>{role.category}</h5>
          <div className='hidden flex-shrink-0 sm:inline-flex'>
            <div className='Button_main__NewW7 Button_small__pgXYR Button_ghost__gZqlA pointer-events-none'>
              <span className='Button_inner__d7ZPg'>{role.cta}</span>
            </div>
          </div>
          <div className='px-s-1.5 sm:hidden'>
            <ArrowRightIcon />
          </div>
        </div>

        <div className='FeatureList_item-border-bottom__Ar4na' />
      </div>
    </a>
  );
}

function RoleList() {
  const r = data.roles;
  return (
    <div className='FeatureList_main__OqQMF'>
      <div className='mb-xl-16 flex px-sms text-theme-tertiary'>
        <h2 className='t-h2'>{r.heading}</h2>
        <span className='t-team-meta'>({r.countLabel})</span>
      </div>
      <div className='FeatureList_inner__UOo8l'>
        {r.items.map((role) => (
          <RoleRow key={role.href} role={role} />
        ))}
      </div>
    </div>
  );
}

/**
 * /careers — `data-theme="dark"` (#101010). This IS the one genuinely dark page
 * of the three; /about is `green` and /contact is `yellow`.
 *
 * Order, straight from the frozen DOM: oversized `t-d2` headline, then the
 * recruitment copy in two `t-p-md` columns with its inline links, then the
 * horizontal `CareersImages` band (21 photos, 2 seamless copies — see
 * CareersImagesMarquee for why it is not a grid), then the `FeatureList`
 * "Current roles (1)" list.
 */
export default function CareersPageView() {
  return (
    <section data-theme={data.theme} className='text-theme-secondary transition-colors duration-theme'>
      <div className='info-pb-40 pt-Header-height'>
        <div className='mx-auto info-mb-40 max-w-site info-pt-20'>
          <div className='ui-grid info-gap-y-8 text-theme-secondary'>
            <div className='col-span-full lg:col-span-18 lg:col-start-2'>
              <h1 className='t-d2 indent-20'>
                <RichInline nodes={data.heading} />
              </h1>
            </div>

            <div className='col-span-full lg:col-span-18 lg:col-start-7 xl:col-span-14 xl:col-start-11'>
              <div className='rich-text t-p-md gap-x-sgs info-space-y-8 sm:columns-2'>
                {data.body
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

        <CareersImagesMarquee images={data.images} />

        <RoleList />
      </div>
    </section>
  );
}
