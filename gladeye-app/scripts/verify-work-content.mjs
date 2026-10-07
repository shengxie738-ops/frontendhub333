// Verifies the /work + /work/<slug> content contract that `build-work-data.mjs` produced,
// cross-checks it against what is on disk, against the captured original DOM in
// `evidence/source-pages/`, and against the HTML this app actually serves.
//
//   node scripts/build-work-data.mjs
//   node scripts/download-assets-gladeye-work.mjs
//   node scripts/verify-work-content.mjs                       # dev server on :3004
//   node scripts/verify-work-content.mjs --base http://127.0.0.1:3004
//   node scripts/verify-work-content.mjs --html .next/server/app/work   # after `npm run build`
//   node scripts/verify-work-content.mjs --slugs cyberbrokers,templar
//
// Rendered HTML is fetched from the dev server when it answers, otherwise read from the
// prerendered output of `npm run build` — every assertion below is identical either way and
// the source actually used is printed per slug. Exit code is non-zero if any check fails.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const ROOT = path.resolve(APP, '..'); // repo root (D:/前端素材页面22)
const CONTENT = path.join(APP, 'src', 'content');
const PUBLIC = path.join(APP, 'public');
const EVIDENCE = path.join(ROOT, 'evidence');
const SOURCE_PAGES = path.join(EVIDENCE, 'source-pages');

const arg = (name) => {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null;
};
const BASE = (arg('base') || process.env.VERIFY_BASE || 'http://127.0.0.1:3004').replace(/\/$/, '');
const HTML_DIR = path.resolve(APP, arg('html') || path.join('.next', 'server', 'app', 'work'));
const ONLY = arg('slugs') ? new Set(arg('slugs').split(',').map((s) => s.trim()).filter(Boolean)) : null;
const FETCH_TIMEOUT_MS = Number(arg('timeout') || 20000);

const readJson = (p) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null);
const data = readJson(path.join(CONTENT, 'projects.json'));
if (!data) {
  console.error('FATAL: src/content/projects.json missing (run scripts/build-work-data.mjs)');
  process.exit(1);
}
const manifest = readJson(path.join(CONTENT, 'asset-manifest.json')) || { jobs: [] };
const assetReport = readJson(path.join(EVIDENCE, 'asset-report-work.json')) || { assets: {}, summary: {} };
const schemaSrc = fs.readFileSync(path.join(CONTENT, 'schema.ts'), 'utf8');

/* ------------------------------------------------------------------ contracts -- */

/**
 * Block types are read out of the two sources that own them, never duplicated here:
 * `CASE_BLOCK_TYPES` in the schema (what the data may contain) and the `case` clauses of
 * `CaseBlocks.tsx` (what the renderer draws). The renderer file must also keep its `never`
 * trap and its `unsupported` → diagnostic route.
 */
function schemaBlockTypes() {
  const block = /export const CASE_BLOCK_TYPES = \[([\s\S]*?)\] as const;/.exec(schemaSrc);
  if (!block) throw new Error('CASE_BLOCK_TYPES not found in src/content/schema.ts');
  return new Set([...block[1].matchAll(/'([a-z-]+)'/g)].map((m) => m[1]));
}

function renderedBlockTypes() {
  const src = fs.readFileSync(path.join(APP, 'src', 'components', 'case-study', 'CaseBlocks.tsx'), 'utf8');
  const types = new Set();
  for (const m of src.matchAll(/^\s*case '([a-z-]+)':\s*$/gm)) types.add(m[1]);
  if (!/:\s*never = block;/.test(src)) throw new Error('CaseBlocks.tsx lost its `never` exhaustiveness trap in default:');
  if (!/case 'unsupported':/.test(src)) throw new Error('CaseBlocks.tsx no longer routes `unsupported` to the diagnostic');
  if (!/UNRENDERED BLOCK/.test(src)) throw new Error('CaseBlocks.tsx diagnostic is no longer visible on the page');
  types.add('unsupported');
  return types;
}

const SCHEMA_TYPES = schemaBlockTypes();
const HANDLED = renderedBlockTypes();

/** Public paths the origin cannot serve, registered beside their evidence in schema.ts. */
const BLOCKED = new Set([...schemaSrc.matchAll(/'(\/sites\/gladeye\/work\/[^']+)'\s*:/g)].map((m) => m[1]));
const FAILED_ASSETS = Object.entries(assetReport.assets || {})
  .filter(([, a]) => a.status === 'failed' || a.status === 'blocked')
  .map(([out]) => '/' + out);

/** The case pages captured in `evidence/source-pages/` — the ones with a rendered oracle. */
const EVIDENCED = fs
  .readdirSync(SOURCE_PAGES)
  .filter((f) => /^_work_.+\.html$/.test(f))
  .map((f) => f.replace(/^_work_/, '').replace(/\.html$/, ''))
  .filter((s) => Object.prototype.hasOwnProperty.call(data.projects, s));

const slugs = Object.keys(data.projects).filter((s) => !ONLY || ONLY.has(s));

let failures = 0;
const rows = [];
const check = (slug, name, ok, detail = '') => {
  rows.push({ slug, name, ok, detail: String(detail) });
  if (!ok) failures++;
};

/* --------------------------------------------------------------- per project -- */

const titles = new Map();
/** The original paints a 20px blurred LQIP under every asset, so an image is 2 `<img>`. */
const IMGS_PER_ASSET = 2;

const mediaInventory = (p) => {
  const frames = [];
  const add = (asset, where) => {
    if (!asset) return;
    const local = `/sites/gladeye/work/${p.slug}/${asset.local}`;
    frames.push({ where, local, blocked: BLOCKED.has(local) });
  };
  add(p.hero.portrait, 'hero-portrait');
  add(p.hero.landscape, 'hero-landscape');
  p.blocks.forEach((b, i) => {
    for (const m of b.items || []) {
      if (m.kind === 'image') add(m.image, `block${i}:${b.type}`);
      else if (m.kind === 'carousel') (m.images || []).forEach((s, j) => add(s, `block${i}:${b.type}#slide${j}`));
    }
  });
  return { frames, count: frames.filter((f) => !f.blocked).length * IMGS_PER_ASSET, blockedCount: frames.filter((f) => f.blocked).length * IMGS_PER_ASSET };
};

const runsText = (runs) => (runs || []).map((r) => (typeof r === 'string' ? r : r.text || '')).join('');
const richText = (nodes) =>
  (nodes || [])
    .map((n) => (n.t === 'ul' || n.t === 'ol' ? (n.items || []).map((i) => runsText(i.runs)).join(' ') : runsText(n.runs)))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

for (const slug of slugs) {
  const p = data.projects[slug];

  // 1. every case has its own block sequence
  check(slug, 'blocks:non-empty', Array.isArray(p.blocks) && p.blocks.length > 0, `${p.blocks?.length ?? 0} blocks`);

  // 2. every block type is declared by the schema union and drawn by the renderer
  const undeclared = p.blocks.filter((b) => !SCHEMA_TYPES.has(b.type));
  check(slug, 'blocks:declared-in-schema', undeclared.length === 0, `unknown: ${undeclared.map((b) => b.type).join(',')}`);
  const unhandled = p.blocks.filter((b) => !HANDLED.has(b.type));
  check(slug, 'blocks:renderer-handles', unhandled.length === 0, `no case for: ${unhandled.map((b) => b.type).join(',')}`);

  // 3. nothing was tagged unsupported by the builder (those would render as diagnostics)
  const unsupported = p.blocks.filter((b) => b.type === 'unsupported');
  check(slug, 'blocks:no-unsupported', unsupported.length === 0, unsupported.map((b) => b.component).join(','));

  // 4. the case carries media of its own
  const media = p.blocks.flatMap((b) => b.items || []);
  const images = media.filter((m) => m.kind === 'image' && m.image).length;
  const carousels = media.filter((m) => m.kind === 'carousel' && (m.images || []).length).length;
  const videos = media.filter((m) => m.kind === 'video' && m.source).length + p.blocks.filter((b) => b.type === 'framed-video' && b.source).length;
  check(slug, 'media:non-empty', images + carousels + videos > 0, `${images} img / ${carousels} deck / ${videos} video`);

  // 5. every referenced image is on disk, except the ones registered as blocked upstream
  const inv = mediaInventory(p);
  const missing = inv.frames.filter((f) => !f.blocked && !fs.existsSync(path.join(PUBLIC, f.local.replace(/^\//, '').split('/').join(path.sep))));
  check(slug, 'assets:all-local', missing.length === 0, missing.map((f) => `${f.where}=${path.basename(f.local)}`).slice(0, 4).join(', '));
  const unregisteredBlocked = inv.frames.filter((f) => f.blocked && !FAILED_ASSETS.includes(f.local));
  check(slug, 'assets:blocked-are-evidenced', unregisteredBlocked.length === 0, `${unregisteredBlocked.length} blocked frame(s) with no failure on record in asset-report-work.json`);

  // 6. the hero has at least one usable cover
  check(
    slug,
    'hero:has-image',
    Boolean(p.hero.portrait || p.hero.landscape || p.hero.thumbnail),
    [p.hero.portrait, p.hero.landscape, p.hero.thumbnail].map((h) => (h ? 'y' : '-')).join(''),
  );

  // 7. next-project relation resolves to another real case
  const nextSlug = p.next && p.next.slug;
  check(
    slug,
    'next:resolves',
    Boolean(nextSlug) && Object.prototype.hasOwnProperty.call(data.projects, nextSlug),
    nextSlug ? `${nextSlug} (${p.next.source})` : 'no next',
  );

  // 8. identity: title, intro heading + lead, metadata, theme
  check(slug, 'title:non-empty', typeof p.title === 'string' && p.title.trim().length > 0, JSON.stringify(p.title));
  titles.set(p.title.trim().toLowerCase(), [...(titles.get(p.title.trim().toLowerCase()) || []), slug]);
  check(slug, 'intro:heading', richText(p.intro.headingDoc).length > 0, richText(p.intro.headingDoc).slice(0, 48));
  check(slug, 'intro:lead', richText(p.intro.leadDoc).length > 40, `${richText(p.intro.leadDoc).length} chars`);
  check(
    slug,
    'intro:metadata',
    Boolean(p.client && p.client.name) && Boolean(p.category) && Boolean(p.date),
    [p.client?.name, p.category, p.date].filter(Boolean).join(' / '),
  );
  check(slug, 'theme:declared', p.theme === 'dark' || p.theme === 'light', p.theme + (p.accent ? ' ' + p.accent : ' (yellow frame)'));
}

/* --------------------------------------------------- rendered page assertions -- */

const readStatic = (slug) => {
  for (const cand of [path.join(HTML_DIR, `${slug}.html`), path.join(HTML_DIR, slug, 'index.html')])
    if (fs.existsSync(cand)) return { html: fs.readFileSync(cand, 'utf8'), from: path.relative(APP, cand) };
  return null;
};

const fetchHtml = async (slug) => {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(`${BASE}/work/${slug}`, { signal: ctrl.signal });
    clearTimeout(t);
    if (res.ok) return { html: await res.text(), from: `${BASE}/work/${slug}`, status: res.status };
    return { html: null, why: `http-${res.status}` };
  } catch (e) {
    return { html: null, why: (e && (e.cause?.code || e.name)) || String(e) };
  }
};

const decode = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&ldquo;/g, '\u201c')
    .replace(/&rdquo;/g, '\u201d')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
const textOf = (h) => decode(h.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const all = (html, re) => [...html.matchAll(re)];

const rendered = {};
let htmlSource = null;
for (const slug of EVIDENCED.filter((s) => !ONLY || ONLY.has(s))) {
  const p = data.projects[slug];
  const got = await fetchHtml(slug);
  let html = got.html;
  let from = got.html ? `${BASE} (${got.status})` : null;
  if (!html) {
    const staticFile = readStatic(slug);
    if (staticFile) {
      html = staticFile.html;
      from = `prerendered ${staticFile.from}${got.why ? ` [server: ${got.why}]` : ''}`;
    }
  }
  if (!html) {
    check(slug, 'rendered:html-available', false, `${BASE} did not answer (${got.why}) and no file under ${path.relative(APP, HTML_DIR)}`);
    continue;
  }
  htmlSource = htmlSource || from;
  rendered[slug] = html;
  check(slug, 'rendered:html-available', true, from);

  // -- it is this case's own page: title, h1, lead copy, accent colour
  const title = /<title>([^<]*)<\/title>/.exec(html);
  check(slug, 'rendered:title', title && decode(title[1]).trim() === `${p.title.trim()} - Gladeye`, title ? decode(title[1]).trim() : 'no <title>');
  const h1s = all(html, /<h1[^>]*>([\s\S]*?)<\/h1>/g).map((m) => textOf(m[1]));
  check(slug, 'rendered:h1-is-own-title', h1s.includes(p.title.trim()), JSON.stringify(h1s[0] || '').slice(0, 60));
  const lead = richText(p.intro.leadDoc);
  check(slug, 'rendered:lead-copy', lead.length > 0 && decode(html).includes(lead.slice(0, 60)), lead.slice(0, 52) + '…');
  check(
    slug,
    'rendered:own-accent',
    !p.accent || decode(html).toLowerCase().includes(p.accent.toLowerCase()),
    p.accent || 'no accent (brand yellow frame)',
  );

  // -- block sequence: order and types come off the data-block-* markers
  const types = all(html, /data-block-type="([^"]*)"/g).map((m) => m[1]);
  const idx = all(html, /data-block-index="(\d+)"/g).map((m) => Number(m[1]));
  const want = p.blocks.map((b) => b.type);
  check(
    slug,
    'rendered:block-sequence',
    types.length === want.length && idx.length === want.length && types.every((t, i) => t === want[i]) && idx.every((n, i) => n === i),
    `${types.length}/${want.length} in order: ${types.join(',')}`
  );

  // -- nothing dropped silently, and nothing left undiagnosed
  check(slug, 'rendered:no-diagnostics', !/UNRENDERED BLOCK|UNRENDERED RICH NODE|data-block-unhandled/.test(html), 'visible error block(s) on the page');

  // -- media: <img> count equals this project's own inventory …
  const inv = mediaInventory(p);
  const imgCount = all(html, /<img[\s>]/g).length;
  check(slug, 'rendered:img-count', imgCount === inv.count, `served ${imgCount} == projects.json ${inv.count} (+${inv.blockedCount} blocked frames not drawn)`);

  // -- … and equals the captured original DOM, minus what the origin cannot serve
  const domPath = path.join(SOURCE_PAGES, `_work_${slug}.html`);
  if (fs.existsSync(domPath)) {
    const domImgs = all(fs.readFileSync(domPath, 'utf8'), /<img[\s>]/g).length;
    check(slug, 'rendered:img-count-vs-original', imgCount === domImgs - inv.blockedCount, `clone ${imgCount} vs original DOM ${domImgs} - blocked ${inv.blockedCount}`);
  }

  // -- every local image the page asks for really exists
  const localSrcs = [...new Set(all(html, /<img[^>]*\bsrc="(\/sites\/gladeye\/work\/[^"]+)"/g).map((m) => m[1]))];
  const broken = localSrcs.filter((s) => !BLOCKED.has(s) && !fs.existsSync(path.join(PUBLIC, s.replace(/^\//, '').split('/').join(path.sep))));
  check(slug, 'rendered:img-srcs-exist', broken.length === 0, `${localSrcs.length} local src(s), missing: ${broken.slice(0, 3).join(', ')}`);

  // -- blocked frames are announced, never substituted
  if (inv.blockedCount) {
    const missing = inv.frames.filter((f) => f.blocked).filter((f) => !html.includes(`data-blocked-asset="${f.local}"`));
    check(slug, 'rendered:blocked-announced', missing.length === 0, missing.map((f) => path.basename(f.local)).join(', ') || inv.frames.filter((f) => f.blocked).map((f) => path.basename(f.local)).join(','));
  }

  // -- the "Up Next" link points at this project's own successor
  const links = [...new Set(all(html, /href="(\/work\/[a-z0-9-]+)"/g).map((m) => m[1]))].filter((l) => l !== `/work/${slug}`);
  check(slug, 'rendered:next-link', p.next ? links.includes(`/work/${p.next.slug}`) : links.length === 0, `want /work/${p.next?.slug ?? '(none)'}, page links: ${links.join(' ')}`);
}

/* ------------------------------------------------------------------- global -- */

const dupes = [...titles.entries()].filter(([, list]) => list.length > 1);
check('ALL', 'titles:unique', dupes.length === 0, dupes.map(([t, l]) => `"${t}" => ${l.join(', ')}`).join(' | ') || `${titles.size} distinct titles over ${slugs.length} cases`);

const served = Object.entries(rendered).map(([slug, html]) => [/<title>([^<]*)<\/title>/.exec(html)?.[1]?.trim(), slug]);
const servedDupes = served.filter(([t]) => t).filter(([t], i, a) => a.findIndex(([x]) => x === t) !== i);
check('ALL', 'rendered:titles-unique', servedDupes.length === 0, servedDupes.map(([t, s]) => `${t} (${s})`).join(' | ') || `${served.length} served pages, all titles distinct`);

// a shared template would make two pages byte-identical in their block region
const fingerprints = Object.entries(rendered).map(([slug, html]) => [slug, html.length + ':' + all(html, /data-block-type="([^"]*)"/g).map((m) => m[1]).join(',')]);
const sameFingerprint = fingerprints.filter(([s, f], i, a) => a.findIndex(([, x]) => x === f) !== i);
check('ALL', 'rendered:not-a-shared-template', sameFingerprint.length === 0, sameFingerprint.map(([s]) => s).join(', ') || `${fingerprints.length} pages, each with its own block sequence + byte length`);

check(
  'ALL',
  'assets:work-page-images-local',
  (() => {
    const refs = [];
    for (const f of data.featured) if (f.image) refs.push(`${f.slug}/${f.image.local}`);
    for (const a of data.archive) if (a.preview) refs.push(`${a.slug}/${a.preview.local}`);
    const missing = refs.filter((rel) => {
      const pub = `/sites/gladeye/work/${rel}`;
      if (BLOCKED.has(pub)) return false;
      return !fs.existsSync(path.join(PUBLIC, pub.replace(/^\//, '').split('/').join(path.sep)));
    });
    if (missing.length) console.log('    missing: ' + missing.slice(0, 5).join(', '));
    return missing.length === 0;
  })(),
  `${data.featured.length} featured cards + ${data.archive.length} archive previews`,
);

check('ALL', 'featured:count', data.featured.length === data.featuredOrder.length, `${data.featured.length}`);
check('ALL', 'archive:count', data.archive.length === data.archiveOrder.length, `${data.archive.length}`);
check('ALL', 'archive:every-row-has-preview', data.archive.every((a) => a.preview), `${data.archive.filter((a) => !a.preview).length} row(s) without a hover preview`);
// `build-work-data.mjs` records several kinds of note. The markup/block ones are real
// failures (an unhandled ProseMirror node or Storyblok component would drop content); the
// name-order one is an editorial observation about which successor rule fired, so it is
// reported but does not fail the gate.
const STRUCTURAL_DIAGNOSTICS = ['unknownProseMirrorNodes', 'unknownProseMirrorMarks', 'unsupportedBlockComponents', 'domBlockMismatch'];
const structural = Object.entries(data.diagnostics || {}).filter(([k]) => STRUCTURAL_DIAGNOSTICS.includes(k));
check(
  'ALL',
  'diagnostics:no-dropped-content',
  structural.every(([, v]) => !v.length),
  structural.map(([k, v]) => `${k}=${v.length}`).join(' ') +
    ` | editorial notes kept for the report: ${Object.keys(data.diagnostics || {}).filter((k) => !STRUCTURAL_DIAGNOSTICS.includes(k)).join(', ') || 'none'}`,
);
for (const [k, v] of Object.entries(data.diagnostics || {}))
  if (!STRUCTURAL_DIAGNOSTICS.includes(k) && v.length) console.log(`  note  ${k}: ${JSON.stringify(v)}`);
check('ALL', 'manifest:covers-projects', manifest.jobs.length > 0, `${manifest.jobs.length} jobs / ${new Set(manifest.jobs.map((j) => j.slug)).size} slugs`);

/* ---- asset report: the failures + the ratio drifts must each be accounted for ---- */

const sum = assetReport.summary || {};
/** An asset that did not land: `failed` before triage, `blocked` once proven unreachable. */
const failedAssets = Object.entries(assetReport.assets || {}).filter(([, a]) => a.status === 'failed' || a.status === 'blocked');
check('ALL', 'asset-report:failed-count', failedAssets.length === (sum.failed ?? 0), `${failedAssets.length} did not land of ${sum.requested ?? '?'} requested (summary.failed=${sum.failed}, summary.blocked=${sum.blocked})`);
for (const [out, a] of failedAssets) {
  const localOnDisk = fs.existsSync(path.join(APP, 'public', out.split('/').slice(2).join(path.sep)));
  check(
    'ALL',
    `asset-report:failure-marked-blocked[${a.slug}]`,
    a.status === 'blocked' && a.blocked === true && BLOCKED.has('/' + out) && !localOnDisk && a.placeholder === false && assetReport.policy?.placeholdersUsed === false,
    `${out} http=${a.httpStatus} ${a.error}; status=blocked, registered in schema.ts, nothing written to public/, no placeholder. ${a.blockedProbes ? 'probes: ' + a.blockedProbes.join(' | ') : ''}`,
  );
}
const drift = Object.entries(assetReport.assets || {}).filter(([, a]) => a.proportional === false);
check('ALL', 'asset-report:ratio-drift-count', drift.length === (sum.ratioMismatched ?? 0), `${drift.length} drifted of ${sum.requested} (summary.ratioMismatched=${sum.ratioMismatched}, resolved=${sum.ratioResolved})`);
for (const [out, a] of drift) {
  check(
    'ALL',
    `asset-report:ratio-resolved[${a.slug}/${path.basename(out).slice(0, 30)}]`,
    a.ratioResolution === 'confirmed-original-url' && a.originalDomUrlCount > 0 && a.deliveredMatchesOriginal === true,
    `delivered ${a.width}x${a.height} vs path ${a.naturalWidth}x${a.naturalHeight}: ${a.ratioResolution || 'UNRESOLVED'}` +
      `${a.originalDomUrlCount ? ` · referenced ${a.originalDomUrlCount}x in evidence/source-pages/_work_${a.slug}.html, variants ${JSON.stringify(a.originalDomUrlVariants)}` : ''}` +
      `${a.deliveredMatchesOriginal ? ' · origin bytes == local file (sha256)' : ''}`,
  );
}
check('ALL', 'asset-report:no-placeholders', assetReport.policy?.placeholdersUsed === false && !Object.values(assetReport.assets || {}).some((a) => a.placeholder), `placeholdersUsed=${assetReport.policy?.placeholdersUsed}`);

/* ------------------------------------------------------------------- output --- */

const bySlug = new Map();
for (const r of rows) {
  if (!bySlug.has(r.slug)) bySlug.set(r.slug, []);
  bySlug.get(r.slug).push(r);
}

console.log(`verify-work-content  base=${BASE}  fallback=${path.relative(APP, HTML_DIR)}  html source=${htmlSource || 'NONE'}`);
console.log(`contracts: ${SCHEMA_TYPES.size} schema block types, ${HANDLED.size} renderer cases (+never trap), ${BLOCKED.size} blocked asset(s), ${EVIDENCED.length} captured case page(s)`);

const summaryTable = [];
for (const slug of EVIDENCED) {
  const p = data.projects[slug];
  const html = rendered[slug];
  const inv = mediaInventory(p);
  summaryTable.push(
    [
      slug,
      (p.title || '').slice(0, 30).padEnd(31),
      String(p.blocks.length).padStart(6),
      String(p.blocks.flatMap((b) => b.items || []).length).padStart(6),
      String(inv.frames.length).padStart(6),
      html ? String(all(html, /<img[\s>]/g).length).padStart(6) : '     -',
      ' ' + (p.next?.slug || '(none)'),
      html ? ' yes' : ' no',
    ].join(' ')
  );
}

if (!ONLY || ONLY.size > 3) {
  console.log(`\nslug                                 title                             blocks media frames   <img> nextSlug                         own-html`);
  for (const line of summaryTable) console.log(line);
}

for (const [slug, list] of bySlug) {
  if (slug !== 'ALL') {
    const p = data.projects[slug];
    const kinds = {};
    for (const b of p.blocks) kinds[b.type] = (kinds[b.type] || 0) + 1;
    console.log(`\n${slug}  (${p.theme}${p.accent ? ' ' + p.accent : ''}, ${p.blocks.length} blocks: ${Object.entries(kinds).map(([k, v]) => k + '×' + v).join(', ')})`);
  }
  for (const r of list)
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.slug === 'ALL' ? '' : r.slug.padEnd(36)}${r.name.padEnd(32)}${r.detail}`);
}

const passed = rows.filter((r) => r.ok).length;
console.log(
  `\n${'='.repeat(78)}\n${passed}/${rows.length} checks passed across ${slugs.length} case studies ` +
    `(${data.featured.length} featured, ${data.archive.length} archive rows, ${Object.keys(rendered).length} rendered page(s) compared against projects.json and the captured original DOM).\n${'='.repeat(78)}`,
);
if (failures) {
  console.log(`\n${failures} FAILING CHECK(S):`);
  for (const r of rows.filter((x) => !x.ok)) console.log(`  ${r.slug} ${r.name}: ${r.detail}`);
  process.exitCode = 1;
}
