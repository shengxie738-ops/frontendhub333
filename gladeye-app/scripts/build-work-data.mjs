// Builds src/content/projects.json for /work and /work/[slug] from the captured
// evidence (evidence/source-pages/*.html -> Next.js RSC payload -> Storyblok stories).
//
// Order and ownership always come from the *rendered HTML* (DOM appearance order),
// never from file names or request order. The Storyblok payload supplies the content;
// the DOM supplies the layout frame classes + the sequence used on the live page.
//
//   node scripts/build-work-data.mjs [--root <repoRoot>]
//
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.argv.includes('--root')
  ? process.argv[process.argv.indexOf('--root') + 1]
  : path.resolve(HERE, '../..');
const PAGES = path.join(ROOT, 'evidence', 'source-pages');
const OUT = path.join(ROOT, 'gladeye-app', 'src', 'content');

const BS = String.fromCharCode(92);
const QUOTE = String.fromCharCode(34);
const DOLLAR = String.fromCharCode(36);

/* ------------------------------------------------------------------ RSC ---- */

function payloadOf(file) {
  const html = fs.readFileSync(file, 'utf8');
  let out = '';
  const re = new RegExp(
    'self\\.__next_f\\.push\\(\\[(\\d+),' + QUOTE + '([\\s\\S]*?)' + QUOTE + '\\]\\)</script>',
    'g',
  );
  let m;
  while ((m = re.exec(html))) {
    try {
      out += JSON.parse(QUOTE + m[2] + QUOTE);
    } catch {
      /* chunk we cannot decode is skipped, never guessed */
    }
  }
  return out;
}

function balanceJson(src, openIdx) {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let j = openIdx; j < src.length; j++) {
    const c = src[j];
    if (inStr) {
      if (esc) esc = false;
      else if (c === BS) esc = true;
      else if (c === QUOTE) inStr = false;
      continue;
    }
    if (c === QUOTE) inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return j;
    }
  }
  return -1;
}

// RSC row 12 of every work route: ["$","$L17",null,{...props}]
const PAGE_KEY = '12:[' + QUOTE + DOLLAR + QUOTE + ',' + QUOTE + DOLLAR + 'L17' + QUOTE + ',null,';

function pageProps(file) {
  const p = payloadOf(file);
  const i = p.indexOf(PAGE_KEY);
  if (i < 0) throw new Error('no RSC props row in ' + file);
  const j = i + PAGE_KEY.length;
  const end = balanceJson(p, j);
  return JSON.parse(p.slice(j, end + 1));
}

/* ------------------------------------------------------------------ DOM ---- */

/** depth-1 <div> children of the element carrying `marker` */
function childDivs(html, marker, limit = 400) {
  const body = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
  const i = body.indexOf(marker);
  if (i < 0) return [];
  const seg = body.slice(i);
  const start = seg.indexOf('<div');
  const out = [];
  let depth = 0;
  let buf = '';
  for (let j = start; j < seg.length && out.length < limit; j++) {
    const rest = seg.slice(j, j + 5);
    if (rest.startsWith('<div')) {
      depth++;
      if (depth === 1) buf = '';
    }
    if (depth >= 1) buf += seg[j];
    if (seg.slice(j, j + 6) === '</div>') {
      depth--;
      if (depth === 0) {
        out.push(buf);
        buf = '';
      }
    }
  }
  return out;
}

const cls = (tag) => (/class="([^"]*)"/.exec(tag) || [, ''])[1];
const styleAttr = (tag) => (/style="([^"]*)"/.exec(tag) || [, ''])[1];
const plain = (html) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x22;/g, '"')
    .trim();

/** unwrap a /_next/image?url=<encoded>&w=.. src back to the storyblok asset */
function unwrapNextImage(src) {
  if (!src) return src;
  const m = /url=([^&"]*)/.exec(src);
  if (src.includes('/_next/image') && m) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return src;
    }
  }
  return src;
}

function naturalFromUrl(url) {
  const m = /\/(\d+)x(\d+)\//.exec(url || '');
  return m ? { w: +m[1], h: +m[2] } : { w: null, h: null };
}
function basenameFromUrl(url) {
  const clean = String(url).split('/m/')[0];
  const parts = clean.split('/').filter(Boolean);
  const file = parts[parts.length - 1] || 'asset';
  const hash = parts[parts.length - 2] || '';
  const dims = /\/(\d+x\d+)\//.exec(clean) || [, ''];
  return [dims[1], hash ? hash.slice(0, 10) : '', file].filter(Boolean).join('-');
}

/* ------------------------------------------------------------ rich text ---- */

const unknownNodes = new Set();
const unknownMarks = new Set();

function runsOf(node) {
  const runs = [];
  const walk = (n, inherit) => {
    if (!n) return;
    if (n.type === 'text') {
      const run = { text: n.text || '' };
      for (const mk of n.marks || []) {
        if (mk.type === 'bold' || mk.type === 'strong') run.b = 1;
        else if (mk.type === 'italic' || mk.type === 'em') run.i = 1;
        else if (mk.type === 'textStyle') {
          const c = mk.attrs && mk.attrs.color;
          if (c) run.c = c;
          const fs2 = mk.attrs && mk.attrs.fontSize;
          if (fs2) run.fs = fs2;
        } else if (mk.type === 'link') {
          run.href = (mk.attrs && (mk.attrs.href || mk.attrs.url)) || null;
          if (mk.attrs && mk.attrs.target) run.target = mk.attrs.target;
        } else unknownMarks.add(mk.type);
      }
      if (run.text) runs.push({ ...inherit, ...run });
      return;
    }
    const next = { ...inherit };
    for (const mk of n.marks || []) {
      if (mk.type === 'bold' || mk.type === 'strong') next.b = 1;
      else if (mk.type === 'italic' || mk.type === 'em') next.i = 1;
    }
    for (const c of n.content || []) walk(c, next);
  };
  walk(node, {});
  return runs;
}

/** ProseMirror doc -> compact node list (paragraph / bullets / heading / image?) */
function docToNodes(doc) {
  if (!doc || !doc.content) return [];
  const nodes = [];
  for (const block of doc.content) {
    if (block.type === 'paragraph') {
      const runs = runsOf(block);
      if (runs.length) nodes.push({ t: 'p', runs });
      else nodes.push({ t: 'p', runs: [{ text: '' }] });
    } else if (block.type === 'bullet_list' || block.type === 'ordered_list') {
      const items = [];
      for (const li of block.content || []) {
        const runs = [];
        for (const para of li.content || []) if (para.type === 'paragraph') runs.push(...runsOf(para));
        if (runs.length) items.push({ runs });
      }
      nodes.push({ t: block.type === 'bullet_list' ? 'ul' : 'ol', items });
    } else if (block.type === 'heading') {
      nodes.push({ t: 'h', level: (block.attrs && block.attrs.level) || 2, runs: runsOf(block) });
    } else if (block.type === 'horizontal_rule') {
      nodes.push({ t: 'hr' });
    } else if (block.type === 'image') {
      nodes.push({ t: 'inlineImage', src: (block.attrs && (block.attrs.src || block.attrs.filename)) || '' });
    } else unknownNodes.add(block.type);
  }
  return nodes;
}

const docText = (nodes) =>
  nodes
    .map((n) => (n.runs ? n.runs.map((r) => r.text).join('') : (n.items || []).map((i) => i.runs.map((r) => r.text).join('')).join(' | ')))
    .join('\n');

/* ---------------------------------------------------------------- assets --- */

const assets = new Map(); // localRel -> record
function assetOf(url, kind, altHint) {
  if (!url) return null;
  const clean = String(url).split('/m/')[0];
  const nat = naturalFromUrl(clean);
  const local = basenameFromUrl(clean);
  const key = clean;
  if (!assets.has(key)) {
    assets.set(key, {
      src: clean,
      local,
      naturalWidth: nat.w,
      naturalHeight: nat.h,
      naturalRatio: nat.w && nat.h ? +(nat.w / nat.h).toFixed(4) : null,
      kind: 'image',
      alt: altHint || 'Gladeye',
    });
  }
  return { ...assets.get(key), kind: kind || assets.get(key).kind };
}

function vimeoIdOf(source) {
  const m = /(?:vimeo\.com\/|playback\/)(\d+)/.exec(String(source || ''));
  return m ? m[1] : null;
}

/* --------------------------------------------------------------- blocks ---- */

const FRAME_SINGLE = 'relative col-span-full aspect-[1680/970]';
const FRAME_PAIR = 'relative col-span-full aspect-square sm:col-span-6 lg:col-span-12';

function frameRatioOf(frameClass) {
  const m = /aspect-\[(\d+)\/(\d+)\]/.exec(frameClass);
  if (m) return +(m[1] / m[2]).toFixed(4);
  if (/aspect-square/.test(frameClass)) return 1;
  return null;
}

/**
 * One work_bloks_images_videos group renders as one ui-grid whose direct children
 * are one per sub-blok (an image blok holding several images renders ONE frame with
 * stacked, cross-fading slides — verified in the DOM of into-the-amazon block 16).
 */
function blockFromGroup(group, domChild, accent) {
  const subs = group.bloks || [];
  const domClasses = domChild
    ? [...domChild.matchAll(/<div class="(relative col-span[^"]*)"/g)].map((m) => m[1])
    : [];
  const frameBackground = accent || 'rgb(251 197 0)';
  const items = subs
    .map((sub, i) => {
      const frameClass = domClasses[i] || (subs.length > 1 ? FRAME_PAIR : FRAME_SINGLE);
      const base = {
        frameClass,
        frameRatio: frameRatioOf(frameClass),
        objectFit: 'cover',
        objectPosition: '50% 50%',
        frameBackground,
        layout: domClasses.length ? 'from-dom' : 'derived',
      };
      if (sub.component === 'work_bloks_image') {
        const images = (sub.images || [])
          .map((im) => assetOf(im.filename, 'image', im.alt || undefined))
          .filter(Boolean);
        if (images.length > 1)
          return {
            ...base,
            kind: 'carousel',
            images,
            intervalMs: Number(sub.interval || 0) || undefined,
            durationMs: Number(sub.duration || 0) || undefined,
          };
        return { ...base, kind: 'image', image: images[0] || null };
      }
      if (sub.component === 'work_bloks_video') {
        return {
          ...base,
          kind: 'video',
          vimeoId: vimeoIdOf(sub.source),
          source: sub.source,
          embedAspect: 1.7777777777777777,
          aspectRatio: sub.aspect_ratio || null,
        };
      }
      return null;
    })
    .filter(Boolean);
  const carousel = items.find((i) => i.kind === 'carousel');
  return {
    type: items.length > 1 ? 'media-pair' : carousel ? 'media-carousel' : 'contained-media',
    wrapClass: domChild
      ? (/class="([^"]*)"/.exec(domChild) || [, 'ui-grid mx-auto my-sgs max-w-site gap-y-sgs'])[1]
      : 'ui-grid mx-auto my-sgs max-w-site gap-y-sgs',
    items,
    slides: carousel ? carousel.images : undefined,
  };
}

function buildBlocks(story, domChildren) {
  const blocks = [];
  const bloks = story.content.bloks || [];
  bloks.forEach((b, i) => {
    const dom = domChildren[i];
    if (b.component === 'work_bloks_images_videos') {
      const blk = blockFromGroup(b, dom, story.content.color && story.content.color.color);
      blk.wrapClass = dom ? (/class="([^"]*)"/.exec(dom) || [, 'ui-grid mx-auto my-sgs max-w-site gap-y-sgs'])[1] : blk.wrapClass;
      blocks.push(blk);
    } else if (b.component === 'work_bloks_framed_video') {
      const id = vimeoIdOf(b.source);
      const outer = dom ? /--outerAspect:([^;"]+)/.exec(dom) : null;
      const inner = dom ? /--videoAspect:([^;"]+)/.exec(dom) : null;
      blocks.push({
        type: 'framed-video',
        vimeoId: id,
        source: b.source,
        accent: (b.color && b.color.color) || '',
        outerAspect: outer ? outer[1] : b.aspect_ratio || '15/9',
        videoAspect: inner ? inner[1] : '16/9',
        objectFit: 'cover',
        wrapClass: 'mx-auto my-sgs max-w-site px-sms',
      });
    } else if (b.component === 'work_bloks_text') {
      const nodes = docToNodes(b.text);
      const heading = b.heading || '';
      const isCredits = /^credits$/i.test(heading.trim());
      blocks.push({
        type: isCredits ? 'credits' : 'rich-text',
        heading,
        doc: nodes,
        text: docText(nodes),
        wrapClass: dom
          ? (/class="([^"]*)"/.exec(dom) || [, 'ui-grid mx-auto my-xl-20 max-w-site gap-y-6 md:my-xl-40'])[1]
          : 'ui-grid mx-auto my-xl-20 max-w-site gap-y-6 md:my-xl-40',
        headingColClass: 'col-span-full lg:col-span-7 xl:col-span-12',
        bodyColClass: 'col-span-full col-start-1 lg:col-span-17 lg:col-start-8 xl:col-span-12 xl:col-start-13',
      });
    } else if (b.component === 'work_bloks_quote') {
      const nodes = docToNodes(b.quote);
      blocks.push({
        type: 'quote',
        doc: nodes,
        text: docText(nodes),
        attributionName: b.attribution_name || '',
        attributionTitle: b.attribution_title || '',
        wrapClass: 'ui-grid mx-auto mb-xl-20 mt-xl-40 max-w-site gap-y-xl-6 md:mt-xl-60',
      });
    } else if (b.component === 'work_bloks_awards') {
      blocks.push({
        type: 'awards',
        title: 'Project Awards',
        wrapClass: 'ui-grid mx-auto my-xl-40 max-w-site',
        items: (b.items || []).map((a) => ({
          award: a.award || '',
          platform: a.platform || '',
          url: (a.link && (a.link.url || a.link.cached_url)) || null,
        })),
      });
    } else if (b.component === 'work_bloks_stats') {
      blocks.push({
        type: 'stats',
        title: 'Project Statistics',
        wrapClass: 'ui-grid mx-auto my-xl-40 max-w-site',
        items: (b.items || []).map((s) => ({ heading: s.heading || '', description: s.description || '' })),
      });
    } else {
      blocks.push({ type: 'unsupported', component: b.component });
    }
  });
  return blocks;
}

/* ------------------------------------------------------------- projects ---- */

const TAG_NAMES = new Map();

function buildProject(story, nextStory, html, sourceKind) {
  const c = story.content;
  const domChildren = html ? childDivs(html, 'WrokBloks_main__IqYqU') : [];
  const blocks = html ? buildBlocks(story, domChildren.slice(0, (c.bloks || []).length)) : buildBlocks(story, []);
  const domVerified = Boolean(html) && domChildren.length >= (c.bloks || []).length;
  const tags = (c.meta_tags || []).map((t) => TAG_NAMES.get(t) || t);
  const client = c.meta_client || null;
  return {
    slug: story.slug,
    title: (c.label || story.name || story.slug).trim(),
    cmsName: story.name,
    theme: c.theme === 'light' ? 'light' : 'dark',
    accent: (c.color && c.color.color) || '',
    client: client
      ? {
          name: (client.name || '').trim(),
          url: (client.content && client.content.link && client.content.link.url) || null,
        }
      : null,
    category: c.meta_category || '',
    date: (c.meta_date || '').trim(),
    tags,
    visitSite: (c.settings_link && c.settings_link.url) || null,
    hero: {
      portrait: assetOf(c.image_portrait && c.image_portrait.filename, 'image'),
      landscape: assetOf(c.image_landscape && c.image_landscape.filename, 'image'),
      thumbnail: assetOf(c.image_thumbnail && c.image_thumbnail.filename, 'image'),
    },
    intro: {
      headingDoc: docToNodes(c.heading),
      leadDoc: docToNodes(c.lead),
    },
    blocks,
    next: nextStory
      ? {
          slug: nextStory.slug,
          title: (nextStory.content.label || nextStory.name || '').trim(),
          client: (nextStory.content.meta_client && nextStory.content.meta_client.name) || '',
          headingDoc: docToNodes(nextStory.content.heading),
          source: 'case-page-payload',
        }
      : null,
    evidence: {
      source: sourceKind,
      blocksFromDom: domVerified,
      topBlocks: (c.bloks || []).length,
    },
  };
}

/* ------------------------------------------------------------------- main -- */

const workFile = path.join(PAGES, '_work.html');
const workProps = pageProps(workFile);
const workHtml = fs.readFileSync(workFile, 'utf8');

workProps.tags.forEach((t) => TAG_NAMES.set(t.value, t.name));

/* ---- /work : featured order + archive order taken from the rendered DOM ---- */

const featuredDomOrder = [
  ...workHtml.matchAll(/class=" FeaturedWorkGrid_item__hQBLy" href="\/work\/([a-z0-9-]+)"/g),
].map((m) => m[1]);
const archiveDom = [
  ...workHtml.matchAll(
    /<a class="FeatureList_item__3Uvy5 FeatureList_interactive__vocFb" href="\/work\/([a-z0-9-]+)">([\s\S]*?)<\/a>/g,
  ),
].map((m) => {
  const seg = m[2];
  const year = (/<h3 class="t-list-sm">([\s\S]*?)<\/h3>/.exec(seg) || [, ''])[1];
  const title = (/<h4 class="t-h5">([\s\S]*?)<\/h4>/.exec(seg) || [, ''])[1];
  const client = (/<h5 class="t-list hidden lg:block">([\s\S]*?)<\/h5>/.exec(seg) || [, ''])[1];
  const bg = (/style="background:(#[0-9a-fA-F]{3,8});[^"]*"/.exec(seg) || [, ''])[1];
  return {
    slug: m[1],
    year: plain(year),
    titleFromDom: plain(title),
    clientFromDom: plain(client),
    color: bg,
    viewLabel: /View project/.test(seg) ? 'View project' : '',
  };
});

const featuredBloks = workProps.showcase.content.bloks;
const featuredBySlug = new Map(featuredBloks.map((b) => [b.work.slug, b]));
const archiveBySlug = new Map(workProps.work.map((w) => [w.slug, w]));

const boxKids = childDivs(workHtml, 'FeatureList_box__XzHZx', 60);
// FeatureList_box holds one layer per archive row (opacity:0 until hovered)
const previewLayers = boxKids.slice(0, archiveDom.length).map((k) => {
  const src = unwrapNextImage((/src="([^"]*)"/.exec(k) || [, ''])[1]);
  return assetOf(src ? src.split('/m/')[0] : null, 'image');
});

/** per featured card: the two stacked layers as they appear in the DOM (kind + SSR opacity) */
const workHtmlLean = workHtml.replace(/(srcSet|srcset)="[^"]*"/g, '');
function featuredDomLayers(slug) {
  const start = workHtmlLean.indexOf('class=" FeaturedWorkGrid_item__hQBLy" href="/work/' + slug + '">');
  if (start < 0) return [];
  const seg = workHtmlLean.slice(start, start + 24000);
  const marks = [...seg.matchAll(/<div class="absolute bottom-0 left-0 right-0 top-0 z-10" style="opacity:([0-9.]+)">/g)];
  const layers = [];
  for (let i = 0; i < marks.length && i < 2; i++) {
    const from = marks[i].index;
    const to = i + 1 < marks.length ? marks[i + 1].index : from + 4000;
    const chunk = seg.slice(from, to);
    const isVid = /<video|&gt;iframe|>iframe|iframe\]:h-full/.test(chunk);
    layers.push({ opacity: +marks[i][1], kind: isVid ? 'video' : 'image' });
  }
  return layers;
}

const featured = featuredDomOrder.map((slug, order) => {
  const b = featuredBySlug.get(slug);
  const w = b.work;
  const multi = (b.thumbnails_multimedia || [])[0] || null;
  const tv = b.thumbnail_video || null;
  const tvSource = typeof tv === 'string' ? tv : (tv && (tv.source || tv.url || tv.filename)) || '';
  const multiSource = multi && (multi.source || multi.filename) ? multi.source || multi.filename : '';
  const videoSource =
    (multi && /vimeo|\.mp4/.test(String(multi.source || '')) && multi.source) ||
    (tvSource && /vimeo|\.mp4/.test(String(tvSource)) ? tvSource : '') ||
    '';
  const otherImage = multi && /\.png|\.jpe?g|\.gif|\.webp/i.test(String(multi.filename || '')) ? multi.filename : null;
  const layers = featuredDomLayers(slug);
  return {
    slug,
    order,
    label: b.label || '',
    client: (b.client && b.client.name) || (w.content.meta_client && w.content.meta_client.name) || '',
    title: (w.content.label || w.name || w.slug).trim(),
    image: assetOf(b.thumbnail && (typeof b.thumbnail === 'string' ? b.thumbnail : b.thumbnail.filename), 'image'),
    multimedia: videoSource
      ? {
          kind: /progressive_redirect|\.mp4/.test(String(videoSource)) ? 'file' : 'vimeo',
          vimeoId: vimeoIdOf(videoSource),
          source: videoSource,
          image: otherImage ? assetOf(otherImage, 'image') : null,
        }
      : otherImage
        ? { kind: 'image', image: assetOf(otherImage, 'image') }
        : null,
    raw: { thumbnail_video: tv, thumbnails_multimedia: b.thumbnails_multimedia || [], thumbnails: b.thumbnails || [] },
    layers,
    hoverModel: layers.length > 1 ? 'cross-fade second layer on hover (live probe verified)' : 'image only',
    frameClass: 'FeaturedWorkGrid_item-image__IiTMQ',
    frameRatio: 16 / 11,
  };
});

const archive = archiveDom.map((row, order) => {
  const w = archiveBySlug.get(row.slug);
  const title = w ? (w.content.label || w.name || w.slug).trim() : row.titleFromDom;
  const clientName = w && w.content.meta_client ? w.content.meta_client.name : row.clientFromDom;
  return {
    slug: row.slug,
    order,
    year: row.year,
    title: row.titleFromDom || title,
    titleFromCms: title,
    client: row.clientFromDom || (clientName || '').trim(),
    color: row.color,
    preview: previewLayers[order] || null,
    viewLabel: row.viewLabel || 'View project',
  };
});

/* ---- project content: prefer the case page payload, fall back to /work payload ---- */

const caseFiles = fs
  .readdirSync(PAGES)
  .filter((f) => f.startsWith('_work_') && f.endsWith('.html'))
  .map((f) => f.replace(/^_work_/, '').replace(/\.html$/, ''));

const projects = {};
const nextKnown = {};

for (const slug of caseFiles) {
  const file = path.join(PAGES, '_work_' + slug + '.html');
  const props = pageProps(file);
  const p = buildProject(props.story, props.nextStory || null, fs.readFileSync(file, 'utf8'), 'case-page');
  projects[slug] = p;
  if (props.nextStory) nextKnown[slug] = props.nextStory.slug;
}

/* next-project relation is verified to follow ascending story name (14/14 pairs). */
const allStories = [...workProps.work, ...featuredBloks.map((b) => b.work)];
const nameOrder = [...allStories].sort((a, b) => a.name.localeCompare(b.name)).map((w) => w.slug);
const derivedPairs = Object.entries(nextKnown).filter(([s, n]) => {
  const i = nameOrder.indexOf(s);
  return i < 0 || nameOrder[i + 1] !== n;
});

for (const w of allStories) {
  if (projects[w.slug]) continue;
  const idx = nameOrder.indexOf(w.slug);
  const nextSlug = idx >= 0 && nameOrder[idx + 1] ? nameOrder[idx + 1] : nameOrder[0];
  projects[w.slug] = buildProject(w, allStories.find((x) => x.slug === nextSlug) || null, null, 'work-payload');
  if (projects[w.slug].next) projects[w.slug].next.source = 'name-order-rule';
}
/* overwrite derived next-slugs for the pages where the payload states it */
for (const [s, n] of Object.entries(nextKnown)) {
  if (projects[s]) projects[s].next = { ...projects[s].next, slug: n, source: 'case-page-payload' };
}

const data = {
  generatedFrom: [
    'evidence/source-pages/_work.html (RSC props: showcase + work + tags)',
    'evidence/source-pages/_work_<slug>.html (RSC props: story + nextStory)',
  ],
  showreel: {
    vimeoId: '879597010',
    title: 'showreel',
    playLabel: 'Play',
    embedUrl:
      'https://player.vimeo.com/video/879597010?title=0&byline=0&portrait=0&autopause=0&controls=0&loop=1',
    evidence: 'live DOM probe of https://www.gladeye.com/work (Video3d_reactPlayer iframe)',
  },
  tags: workProps.tags,
  featuredOrder: featured.map((f) => f.slug),
  archiveOrder: archive.map((a) => a.slug),
  featured,
  archive,
  projects,
  diagnostics: {
    nameOrderRuleViolations: derivedPairs,
    unknownProseMirrorNodes: [...unknownNodes],
    unknownProseMirrorMarks: [...unknownMarks],
    unsupportedBlockComponents: Object.values(projects)
      .flatMap((p) => p.blocks.filter((b) => b.type === 'unsupported').map((b) => p.slug + ':' + b.component)),
    domBlockMismatch: Object.values(projects)
      .filter((p) => p.evidence.source === 'case-page' && !p.evidence.blocksFromDom)
      .map((p) => p.slug + ' (' + p.blocks.length + ' vs ' + p.evidence.topBlocks + ')'),
  },
};

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'projects.json'), JSON.stringify(data, null, 1));

/* asset manifest for the downloader: one job per (slug, file), deduped, with the
   Storyblok resize transform applied for very wide originals (no cropping: /m/Wx0
   preserves the aspect ratio) and a P0/P1/P2 priority used by the downloader. */
const P0_SLUGS = new Set(['into-the-amazon', 'cyberbrokers', 'ekos-genesis']);
const EVIDENCED = new Set(caseFiles);
const jobs = new Map();
const MAX_DELIVERED_WIDTH = 1920;

function queueImage(slug, asset, role, priority) {
  if (!asset || !asset.src) return;
  const key = slug + '/' + asset.local;
  const existing = jobs.get(key);
  if (existing) {
    existing.roles.push(role);
    existing.priority = Math.min(existing.priority, priority);
    return;
  }
  const wide = asset.naturalWidth ? asset.naturalWidth > MAX_DELIVERED_WIDTH : false;
  jobs.set(key, {
    slug,
    file: asset.local,
    out: `sites/gladeye/work/${slug}/${asset.local}`,
    url: wide ? `${asset.src}/m/${MAX_DELIVERED_WIDTH}x0` : asset.src,
    deliveredWidth: wide ? MAX_DELIVERED_WIDTH : asset.naturalWidth,
    naturalWidth: asset.naturalWidth,
    naturalHeight: asset.naturalHeight,
    naturalRatio: asset.naturalRatio,
    roles: [role],
    priority,
  });
}

for (const [slug, p] of Object.entries(projects)) {
  const base = P0_SLUGS.has(slug) ? 0 : EVIDENCED.has(slug) ? 1 : 2;
  queueImage(slug, p.hero.portrait, 'hero-portrait', base);
  queueImage(slug, p.hero.landscape, 'hero-landscape', base);
  queueImage(slug, p.hero.thumbnail, 'cover-thumbnail', base);
  p.blocks.forEach((b, i) => {
    const prio = i < 4 ? base : base + 1;
    (b.items || []).forEach((it) => {
      queueImage(slug, it.image, `block${i}:${b.type}`, prio);
      if (it.kind === 'carousel') (it.images || []).forEach((im) => queueImage(slug, im, `block${i}:slide`, prio));
    });
  });
}
for (const f of featured) {
  queueImage(f.slug, f.image, 'work-featured-thumbnail', 0);
  if (f.multimedia) queueImage(f.slug, f.multimedia.image, 'work-featured-multimedia-image', 0);
}
for (const a of archive) queueImage(a.slug, a.preview, 'work-archive-hover-preview', 0);

const imageJobs = [...jobs.values()].sort((x, y) => x.priority - y.priority || x.slug.localeCompare(y.slug));
fs.writeFileSync(
  path.join(OUT, 'asset-manifest.json'),
  JSON.stringify(
    {
      publicBase: '/sites/gladeye/work',
      note: 'deliveredWidth <= naturalWidth; /m/<w>x0 is a proportional Storyblok resize (never a crop)',
      count: imageJobs.length,
      jobs: imageJobs,
    },
    null,
    1,
  ),
);

/**
 * Video jobs. Only progressive-mp4 sources (work_bloks_framed_video + featured cards)
 * are downloadable; work_bloks_video renders a Vimeo iframe on the original site, so
 * it needs no asset. Priority: featured/flagship first, other evidenced pages next.
 */
const videos = [];
const videoPriority = (slug) => (P0_SLUGS.has(slug) ? 0 : EVIDENCED.has(slug) ? 1 : 2);
for (const p of Object.values(projects)) {
  p.blocks.forEach((b, i) => {
    if (b.type === 'framed-video' && b.source) {
      videos.push({
        slug: p.slug,
        kind: 'framed',
        vimeoId: b.vimeoId,
        source: b.source,
        accent: b.accent,
        blockIndex: i,
        priority: videoPriority(p.slug),
        out: `sites/gladeye/work/${p.slug}/video/framed-${i}-${b.vimeoId || 'x'}.mp4`,
      });
    }
    if (b.type !== 'framed-video')
      (b.items || []).forEach((it) => {
        if (it.kind === 'video' && it.source)
          videos.push({
            slug: p.slug,
            kind: 'iframe',
            vimeoId: it.vimeoId,
            source: it.source,
            priority: videoPriority(p.slug),
            needsDownload: /progressive_redirect|\.mp4/.test(String(it.source)),
          });
      });
  });
}
for (const f of featured)
  if (f.multimedia && f.multimedia.source)
    videos.push({
      slug: f.slug,
      kind: 'featured',
      vimeoId: f.multimedia.vimeoId,
      source: f.multimedia.source,
      priority: f.multimedia.kind === 'file' ? 0 : 9,
      out: `sites/gladeye/work/${f.slug}/video/featured-${f.multimedia.vimeoId || 'x'}.mp4`,
    });
fs.writeFileSync(path.join(OUT, 'video-manifest.json'), JSON.stringify(videos, null, 1));

/* report */
const counts = {};
for (const p of Object.values(projects)) for (const b of p.blocks) counts[b.type] = (counts[b.type] || 0) + 1;
console.log('projects:', Object.keys(projects).length, '| featured:', featured.length, '| archive:', archive.length);
console.log('assets referenced:', assets.size, '| video sources:', videos.length);
console.log('block type totals:', JSON.stringify(counts));
console.log('dom-verified case pages:', Object.values(projects).filter((p) => p.evidence.blocksFromDom).length);
console.log(
  'name-order rule violations:',
  data.diagnostics.nameOrderRuleViolations.length,
  JSON.stringify(data.diagnostics.nameOrderRuleViolations),
);
console.log('unknown prose nodes/marks:', JSON.stringify(data.diagnostics.unknownProseMirrorNodes), JSON.stringify(data.diagnostics.unknownProseMirrorMarks));
console.log('unsupported components:', JSON.stringify(data.diagnostics.unsupportedBlockComponents));
console.log('dom mismatch:', JSON.stringify(data.diagnostics.domBlockMismatch));
