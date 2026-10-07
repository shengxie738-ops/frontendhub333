import MediaBlock, { VideoSource } from './CaseMedia';
import Reveal from './Reveal';
import RichInline from './RichInline';
import RichText from './RichText';

import type {
  AwardsBlockT,
  CaseBlock,
  FramedVideoBlockT,
  MediaBlockT,
  QuoteBlockT,
  RichTextBlockT,
  StatsBlockT,
  UnknownBlock,
} from '@/content/schema';

/* ------------------------------------------------------------------ layout -- */

/** `ui-grid mx-auto my-xl-40 max-w-site` + the rule + the section title. */
function SectionHead({
  wrapClass,
  title,
  childrenColClass,
  blockType,
  blockIndex,
  children,
}: {
  wrapClass: string;
  title: string;
  childrenColClass: string;
  blockType: string;
  blockIndex: number;
  children: React.ReactNode;
}) {
  return (
    <div className={wrapClass} data-block-type={blockType} data-block-index={blockIndex}>
      <div className="col-span-full h-px bg-theme-secondary" />
      <div className="col-span-full py-s-6">
        <h3 className="t-p-md font-medium">{title}</h3>
      </div>
      <div className={childrenColClass}>{children}</div>
    </div>
  );
}

const BODY_COL = 'col-span-full col-start-1 lg:col-span-17 lg:col-start-8 xl:col-span-15 xl:col-start-10';

/* ------------------------------------------------------------------- blocks -- */

/**
 * Every block root carries `data-block-type` / `data-block-index`. They are inert (no CSS
 * reads them, and `.WrokBloks_main__IqYqU > :first-child/:last-child` still sees the same
 * element), and they let `scripts/verify-work-content.mjs` compare the *sequence* of blocks
 * in the served HTML against the sequence in `projects.json` — i.e. prove each case renders
 * its own content in the recorded order instead of a shared template.
 */

/**
 * `work_bloks_text` (and its `Credits` variant, which the builder tags
 * `type:'credits'` but the original renders with the same component):
 *
 *   <div class="ui-grid mx-auto my-xl-20 max-w-site gap-y-6 md:my-xl-40">
 *     <div class="col-span-full lg:col-span-7 xl:col-span-12"><h3 class="t-p-md font-medium">{heading}
 *     <div class="{bodyColClass}"><div class="rich-text t-p-md space-y-6">…
 */
function TextBlock({ block, index }: { block: RichTextBlockT; index: number }) {
  return (
    <div className={block.wrapClass} data-block-type={block.type} data-block-index={index}>
      {block.heading ? (
        <div className={block.headingColClass}>
          <Reveal as="h3" className="t-p-md font-medium" duration={600}>
            {block.heading}
          </Reveal>
        </div>
      ) : null}
      <div className={block.bodyColClass}>
        <RichText nodes={block.doc} className="t-p-md space-y-6" />
      </div>
    </div>
  );
}

/**
 * `work_bloks_quote`:
 *   <div class="ui-grid mx-auto mb-xl-20 mt-xl-40 max-w-site gap-y-xl-6 md:mt-xl-60">
 *     <div class="col-span-19"><h3 class="t-h2"><span>“</span>…<span>”</span></h3></div>
 *     <div class="col-span-full space-y-2"><h4 class="t-p-md-alt">{name}</h4><h5 class="t-meta">{title}</h5>
 * The curly quotes are added by the component, not stored in the CMS text.
 */
function QuoteBlock({ block, index }: { block: QuoteBlockT; index: number }) {
  return (
    <div className={block.wrapClass} data-block-type={block.type} data-block-index={index}>
      <div className="col-span-19">
        <Reveal as="h3" className="t-h2" duration={600}>
          <span>&ldquo;</span>
          <RichInline nodes={block.doc} />
          <span>&rdquo;</span>
        </Reveal>
      </div>
      {block.attributionName || block.attributionTitle ? (
        <div className="col-span-full space-y-2">
          {block.attributionName ? <h4 className="t-p-md-alt">{block.attributionName}</h4> : null}
          {block.attributionTitle ? <h5 className="t-meta">{block.attributionTitle}</h5> : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * `work_bloks_awards` — `Awards_main__Sh08m` with one `Awards_item__YgOl7` per row.
 * h4 is the *platform*, h5 the *award* (verified against the captured DOM, which is the
 * inverse of what the field names suggest).
 */
function AwardsBlock({ block, index }: { block: AwardsBlockT; index: number }) {
  return (
    <SectionHead
      wrapClass={block.wrapClass}
      title={block.title}
      childrenColClass={BODY_COL}
      blockType={block.type}
      blockIndex={index}
    >
      <div className="Awards_main__Sh08m">
        {block.items.map((item, i) => {
          const inner = (
            <>
              <h4 className="t-work-award flex-shrink-0 font-medium">{item.platform}</h4>
              <h5 className="t-work-award-alt truncate">{item.award}</h5>
            </>
          );
          const row = <div className="flex items-center justify-start gap-x-2 py-3 sm:gap-x-4 sm:py-4">{inner}</div>;
          return item.url ? (
            <a key={i} className="Awards_item__YgOl7" target="_blank" rel="nofollow noopener" href={item.url}>
              {row}
            </a>
          ) : (
            <div key={i} className="Awards_item__YgOl7">
              {row}
            </div>
          );
        })}
      </div>
    </SectionHead>
  );
}

/**
 * `work_bloks_stats` — same section head, then per row
 *   <div class="grid grid-cols-12 items-end gap-x-sgs lg:grid-cols-17 xl:grid-cols-15">
 *     <div class="col-span-full lg:col-span-12 xl:col-span-11"><h4 class="t-h1">{heading}
 *     <div class="col-span-full py-1.5 lg:col-span-5 xl:col-span-4"><p class="t-work-stat">{description}
 * Only one stats block is present in the captured pages (ekos-genesis, a single row), so
 * multi-row pages repeat that row wrapper — flagged in the report.
 */
function StatsBlock({ block, index }: { block: StatsBlockT; index: number }) {
  return (
    <SectionHead
      wrapClass={block.wrapClass}
      title={block.title}
      childrenColClass={BODY_COL}
      blockType={block.type}
      blockIndex={index}
    >
      {block.items.map((item, i) => (
        <div key={i} className="border-b border-theme-secondary/20 py-xl-7 lg:border-theme-secondary">
          <div className="grid grid-cols-12 items-end gap-x-sgs lg:grid-cols-17 xl:grid-cols-15">
            <div className="col-span-full lg:col-span-12 xl:col-span-11">
              <h4 className="t-h1">{item.heading}</h4>
            </div>
            <div className="col-span-full py-1.5 lg:col-span-5 xl:col-span-4">
              <p className="t-work-stat">{item.description}</p>
            </div>
          </div>
        </div>
      ))}
    </SectionHead>
  );
}

/**
 * `work_bloks_framed_video` — an accent-coloured bar with the 16/9 clip centred inside a
 * wider outer frame:
 *   <div class="mx-auto my-sgs max-w-site px-sms">
 *     <div style="background:{accent};--outerAspect:15/9" class="FramedVideo_outer__zdvd0 ui-grid
 *          items-center bg-theme-secondary px-0 transition-bg duration-theme">
 *       <div class="col-span-full sm:col-span-10 sm:col-start-2 lg:col-span-20 lg:col-start-3">
 *         <div style="--videoAspect:16/9" class="FramedVideo_videoContainer__ZBbd_ transition-bg duration-theme">
 *           <video class="h-full w-full object-cover" src="…" muted loop playsInline>
 */
function FramedVideoBlock({ block, index }: { block: FramedVideoBlockT; index: number }) {
  return (
    <div className={block.wrapClass} data-block-type={block.type} data-block-index={index}>
      <div
        style={{ background: block.accent || undefined, ['--outerAspect' as string]: block.outerAspect }}
        className="FramedVideo_outer__zdvd0 ui-grid items-center bg-theme-secondary px-0 transition-bg duration-theme"
      >
        <div className="col-span-full sm:col-span-10 sm:col-start-2 lg:col-span-20 lg:col-start-3">
          <div
            style={{ ['--videoAspect' as string]: block.videoAspect }}
            className="FramedVideo_videoContainer__ZBbd_ transition-bg duration-theme"
          >
            <VideoSource src={block.source} vimeoId={block.vimeoId} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- diagnostics -- */

/**
 * Anything the renderer cannot place. This is deliberately loud: a case page must never
 * silently drop a blok, which is why the raw payload keys are printed too.
 */
export function BlockDiagnostic({ block, slug, index }: { block: UnknownBlock; slug: string; index: number }) {
  const type = block.type === undefined ? 'undefined' : String(block.type);
  const component = block.component === undefined ? '' : String(block.component);
  if (typeof console !== 'undefined')
    console.error(`[work] unhandled block "${type}" at ${slug}#${index} — content would be dropped`);
  return (
    <div
      className="mx-auto my-sgs max-w-site px-sms"
      data-block-type={block.type === undefined ? 'undefined' : type}
      data-block-index={index}
      data-block-unhandled="true"
    >
      <div
        style={{
          border: '2px dashed #FF0000',
          color: '#FF0000',
          padding: '1rem',
          fontFamily: 'ui-monospace, monospace',
          fontSize: '0.8rem',
          lineHeight: 1.5,
        }}
      >
        <strong>UNRENDERED BLOCK</strong> · /work/{slug} · index {index} · type=&quot;{type}&quot;
        {component ? ` · component=&quot;${component}&quot;` : ''}
        <br />
        The block renderer has no case for this type, so its content is not on the page. Keys present:{' '}
        {Object.keys(block).join(', ') || 'none'}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- registry --- */

/**
 * Every `type` present in `src/content/projects.json` (produced by
 * `scripts/build-work-data.mjs` from the Storyblok `work_bloks_*` components) — the same
 * list `src/content/schema.ts` declares as `CASE_BLOCK_TYPES`, which is asserted
 * type-level-equal to `CaseBlock['type']` there:
 *
 *   contained-media | media-pair | media-carousel   -> work_bloks_images_videos
 *   framed-video                                    -> work_bloks_framed_video
 *   rich-text | credits                             -> work_bloks_text
 *   quote                                           -> work_bloks_quote
 *   awards                                          -> work_bloks_awards
 *   stats                                           -> work_bloks_stats
 *   unsupported                                     -> any other component (builder-tagged)
 *
 * The `default` branch is a `never` trap: adding a variant to `CaseBlock` without adding a
 * case here is a compile error. At runtime it still renders a diagnostic, because
 * `projects.json` is data — a `type` the schema does not declare must show up on the page,
 * not disappear.
 */
export function BlockRenderer({ block, slug, accent, index }: { block: CaseBlock; slug: string; accent: string; index: number }) {
  switch (block.type) {
    case 'contained-media':
    case 'media-pair':
    case 'media-carousel':
      return <MediaBlock block={block} slug={slug} accent={accent} index={index} />;
    case 'framed-video':
      return <FramedVideoBlock block={block} index={index} />;
    case 'rich-text':
    case 'credits':
      return <TextBlock block={block} index={index} />;
    case 'quote':
      return <QuoteBlock block={block} index={index} />;
    case 'awards':
      return <AwardsBlock block={block} index={index} />;
    case 'stats':
      return <StatsBlock block={block} index={index} />;
    case 'unsupported':
      return <BlockDiagnostic block={block} slug={slug} index={index} />;
    default: {
      // `block` is `never` here — every declared variant is handled above.
      const exhaustive: never = block;
      void exhaustive;
      // Still reachable with hand-edited / future JSON, so report instead of dropping.
      return <BlockDiagnostic block={block as UnknownBlock} slug={slug} index={index} />;
    }
  }
}

export default BlockRenderer;
