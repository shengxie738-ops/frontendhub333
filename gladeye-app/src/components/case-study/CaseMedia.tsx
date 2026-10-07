'use client';

import BlockedMedia from './BlockedMedia';
import CaseImage from './CaseImage';
import ClientVideo from './ClientVideo';
import MediaCarousel from './MediaCarousel';
import Reveal from './Reveal';
import { workAsset } from '@/components/work/data';
import { isPlayableFileSource, vimeoPlayerSrc } from '@/content/schema';

import type { ImageMediaItem, MediaBlockT } from '@/content/schema';

/**
 * `work_bloks_images_videos` — one `.ui-grid` whose children are the media frames.
 *
 * Frame nesting, copied from the captured DOM (`evidence/source-pages/_work_*.html`):
 *
 *   <div class="relative col-span-full aspect-[1680/970]">        <- MediaItem.frameClass
 *     <div class="absolute inset-0 h-full w-full" style="opacity:1">
 *       <div class="h-full w-full" style="background:{accent}">     <- ColorImage (`bg-yellow` when none)
 *         <div class="h-full w-full" style="opacity:0">             <- fades in once the LQIP loaded
 *           <div class="relative overflow-hidden h-full w-full">    <- BlurImage (cover, 50% 50%)
 *
 * `frameClass` carries the real aspect ratio recorded from the DOM, and the image is
 * painted with the original's `object-fit:cover / object-position:50% 50%`. Every asset's
 * natural size is printed on the `<img>` as `data-natural`, so a wrong crop is visible
 * in the DOM rather than hidden behind the frame.
 */

/**
 * The player for `work_bloks_video` / `work_bloks_framed_video`.
 *
 * The captured `source` values come in two shapes and the original site treats them
 * differently, so this does too:
 *   · `player.vimeo.com/progressive_redirect/…file.mp4` → a bare `<video>`
 *     (verified in `_work_ekos-genesis.html`)
 *   · `vimeo.com/<id>[/<private-hash>]`                → the Vimeo embed the original
 *     hydrates into the same box (`_work_eqty-lab-website.html` SSRs an empty
 *     `aspect-ratio:1.7777…` container that its player fills). Passing that URL to
 *     `<video src>` only ever produced a dead player, so it becomes an iframe here.
 */
export function VideoSource({ src, vimeoId }: { src: string; vimeoId: string | null }) {
  if (isPlayableFileSource(src)) return <ClientVideo src={src} />;
  const embed = vimeoPlayerSrc(vimeoId);
  if (!embed) return <BlockedMedia asset={src} reason="video source is not playable and carries no vimeo id" />;
  return (
    <div className="pointer-events-none relative h-full w-full overflow-hidden" data-vimeo-embed={vimeoId ?? undefined}>
      <iframe
        title={`Vimeo video ${vimeoId ?? ''}`}
        src={embed}
        allow="autoplay; fullscreen; picture-in-picture; accelerometer; clipboard-write; encrypted-media"
        allowFullScreen
        loading="lazy"
        style={{ position: 'absolute', inset: 0, height: '100%', width: '100%', border: 0 }}
      />
    </div>
  );
}

function ImageFrame({ item, slug, accent }: { item: ImageMediaItem; slug: string; accent: string }) {
  return (
    <div className={item.frameClass}>
      <div className="absolute inset-0 h-full w-full" style={{ opacity: 1 }}>
        <div className={`h-full w-full ${accent ? '' : 'bg-yellow'}`} style={accent ? { background: accent } : undefined}>
          <Reveal offsetY={null} duration={250} className="h-full w-full">
            <CaseImage asset={item.image} src={workAsset(slug, item.image) ?? ''} sizes="100vw" />
          </Reveal>
        </div>
      </div>
    </div>
  );
}

function Frame({ item, slug, accent }: { item: MediaBlockT['items'][number]; slug: string; accent: string }) {
  switch (item.kind) {
    case 'video':
      return (
        <div className={item.frameClass}>
          <VideoSource src={item.source} vimeoId={item.vimeoId} />
        </div>
      );
    case 'carousel':
      return (
        <div className={item.frameClass}>
          <MediaCarousel item={item} slug={slug} accent={accent} />
        </div>
      );
    case 'image':
      return <ImageFrame item={item} slug={slug} accent={accent} />;
    default: {
      const unhandled: never = item;
      void unhandled;
      return <BlockedMedia reason={`media kind ${(item as { kind?: string }).kind ?? 'undefined'} has no renderer`} />;
    }
  }
}

export function MediaBlock({
  block,
  slug,
  accent,
  index,
}: {
  block: MediaBlockT;
  slug: string;
  accent: string;
  index: number;
}) {
  return (
    <div className={block.wrapClass} data-block-type={block.type} data-block-index={index}>
      {block.items.map((item, i) => (
        <Frame key={i} item={item} slug={slug} accent={accent} />
      ))}
    </div>
  );
}

export default MediaBlock;
