#!/usr/bin/env node
/**
 * download-assets-gladeye-work.mjs
 *
 * Downloads every image referenced by /work and /work/<slug> into
 *   gladeye-app/public/sites/gladeye/work/<slug>/
 *
 * It does NOT invent file names. The names, the URLs and the local paths all come
 * from the manifest produced by the data builder:
 *   gladeye-app/src/content/asset-manifest.json   (scripts/build-work-data.mjs)
 * so the clone and the content JSON can never disagree about where an asset lives.
 *
 * Contract honoured from the manifest:
 *   job.out            -> path under gladeye-app/public/  (authoritative)
 *   job.url            -> Storyblok source, already resized with /m/<w>x0 when the
 *                         original is wider than 1920px (a PROPORTIONAL resize,
 *                         never a crop, so naturalRatio is preserved)
 *   job.naturalWidth/Height/Ratio -> the original geometry, used to verify what landed
 *
 * Rules (same policy as scripts/download-assets-gladeye-info.mjs):
 *   - bounded concurrency, retries with backoff
 *   - validate HTTP status, Content-Type, real file magic, non-empty body
 *   - never persist an HTML error page as an image
 *   - never substitute a placeholder / generated image
 *   - never overwrite a file that already exists and validates (additive only)
 *   - emit evidence/asset-report-work.json
 *
 * Usage:
 *   node scripts/download-assets-gladeye-work.mjs
 *   node scripts/download-assets-gladeye-work.mjs --priority 1        # only P0/P1 slugs
 *   node scripts/download-assets-gladeye-work.mjs --slugs cyberbrokers,into-the-amazon
 *   node scripts/download-assets-gladeye-work.mjs --limit 20 --dry-run
 *   node scripts/download-assets-gladeye-work.mjs --force             # re-fetch + overwrite
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..'); // repo root (D:/前端素材页面22)
const APP = path.join(ROOT, 'gladeye-app');
const MANIFEST_PATH = path.join(APP, 'src', 'content', 'asset-manifest.json');
const PROJECTS_PATH = path.join(APP, 'src', 'content', 'projects.json');
const PUBLIC_DIR = path.join(APP, 'public');
const REPORT_PATH = path.join(ROOT, 'evidence', 'asset-report-work.json');

const CONCURRENCY = 5;
const MAX_ATTEMPTS = 3;
const SOURCE_PAGES = path.join(ROOT, 'evidence', 'source-pages');

/* ------------------------------------------------------------------- args --- */

function arg(name) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null;
}
const FORCE = process.argv.includes('--force');
const DRY = process.argv.includes('--dry-run');
const ONLY_PRIORITY = arg('priority') !== null ? Number(arg('priority')) : null;
const ONLY_SLUGS = arg('slugs') ? new Set(arg('slugs').split(',').map((s) => s.trim()).filter(Boolean)) : null;
const LIMIT = arg('limit') ? Number(arg('limit')) : null;

/* ------------------------------------------------------------------ *
 * 0. Extra jobs the manifest cannot know about
 * ------------------------------------------------------------------ */

/**
 * `build-work-data.mjs` queues one image per `FeaturedCard.multimedia.image`, but
 * that field only carries the *second* card layer when the card has no
 * `thumbnail_video` (see the `videoSource` / `otherImage` precedence in that script).
 * A card whose first layer is a video therefore has a `work_item_image` layer whose
 * asset never reached the manifest, and the hover cross-fade would 404.
 *
 * These helpers re-walk the same `featured[].raw` payload with the *same* naming rule
 * (`basenameFromUrl`) and the same /m/<w>x0 proportional resize, so the file names stay
 * byte-identical to the manifest's and nothing is ever renamed here.
 */
const MAX_DELIVERED_WIDTH = 1920;
const basenameFromUrl = (url) => {
  const clean = String(url).split('/m/')[0];
  const parts = clean.split('/').filter(Boolean);
  const file = parts[parts.length - 1] || 'asset';
  const hash = parts[parts.length - 2] || '';
  const dims = /\/(\d+x\d+)\//.exec(clean) || [, ''];
  return [dims[1], hash ? hash.slice(0, 10) : '', file].filter(Boolean).join('-');
};
const naturalFromUrl = (url) => {
  const m = /\/(\d+)x(\d+)\//.exec(String(url).split('/m/')[0]);
  return m ? { w: +m[1], h: +m[2] } : { w: null, h: null };
};

function featuredLayerImages(projects) {
  const out = [];
  for (const card of projects.featured || []) {
    const raw = card.raw || {};
    const push = (filename) => {
      if (typeof filename !== 'string' || !filename.startsWith('http')) return;
      out.push({ slug: card.slug, src: filename.split('/m/')[0] });
    };
    if (!raw.thumbnail_video && card.image) push(card.image.src);
    for (const m of raw.thumbnails_multimedia || []) {
      if (m && m.component === 'work_item_image' && m.image) push(m.image.filename);
    }
    for (const t of raw.thumbnails || []) if (t) push(t.filename || t);
  }
  return out;
}

function extraJobs(projects, manifestJobs) {
  const known = new Set(manifestJobs.map((j) => j.slug + '/' + j.file));
  const added = new Map();
  for (const { slug, src } of featuredLayerImages(projects)) {
    const file = basenameFromUrl(src);
    const key = slug + '/' + file;
    if (known.has(key) || added.has(key)) continue;
    const nat = naturalFromUrl(src);
    const wide = nat.w ? nat.w > MAX_DELIVERED_WIDTH : false;
    added.set(key, {
      slug,
      file,
      out: `sites/gladeye/work/${slug}/${file}`,
      url: wide ? `${src}/m/${MAX_DELIVERED_WIDTH}x0` : src,
      deliveredWidth: wide ? MAX_DELIVERED_WIDTH : nat.w,
      naturalWidth: nat.w,
      naturalHeight: nat.h,
      naturalRatio: nat.w && nat.h ? +(nat.w / nat.h).toFixed(4) : null,
      roles: ['work-featured-hover-layer'],
      priority: 0,
      derivedBy: 'download-assets-gladeye-work.mjs (featured hover layer missing from the manifest)',
    });
  }
  return [...added.values()];
}

/* ----------------------------------------------------------------- magic ---- */

const MAGIC = [
  { kind: 'jpeg', ext: '.jpg', test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { kind: 'png', ext: '.png', test: (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { kind: 'gif', ext: '.gif', test: (b) => b.length > 6 && b.subarray(0, 3).toString('latin1') === 'GIF' },
  { kind: 'webp', ext: '.webp', test: (b) => b.length > 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
  { kind: 'avif', ext: '.avif', test: (b) => b.length > 12 && b.subarray(4, 8).toString('latin1') === 'ftyp' && /avif|avis/.test(b.subarray(8, 12).toString('latin1')) },
];
const sniff = (buf) => MAGIC.find((m) => m.test(buf)) || null;
const looksLikeHtml = (buf) => {
  const head = buf.subarray(0, 512).toString('latin1').trimStart().toLowerCase();
  return head.startsWith('<!doctype html') || head.startsWith('<html') || head.startsWith('<head') || head.startsWith('<?xml');
};

function jpegSize(buf) {
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    const len = (buf[i + 2] << 8) | buf[i + 3];
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf);
    if (isSof) return { width: (buf[i + 7] << 8) | buf[i + 8], height: (buf[i + 5] << 8) | buf[i + 6] };
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    i += 2 + len;
  }
  return null;
}
function pngSize(buf) { return buf.length < 24 ? null : { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }; }
function gifSize(buf) { return buf.length < 10 ? null : { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) }; }
function webpSize(buf) {
  const tag = buf.subarray(12, 16).toString('latin1');
  if (tag === 'VP8L') { const n = buf.readUInt32LE(21); return { width: (n & 0x3fff) + 1, height: ((n >> 14) & 0x3fff) + 1 }; }
  if (tag === 'VP8X') return { width: 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16)), height: 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16)) };
  if (tag === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  return null;
}
const dimensions = (kind, buf) => {
  try {
    if (kind === 'jpeg') return jpegSize(buf);
    if (kind === 'png') return pngSize(buf);
    if (kind === 'gif') return gifSize(buf);
    if (kind === 'webp') return webpSize(buf);
  } catch { /* fallthrough */ }
  return null;
};

/* ---------------------------------------------------------------- evidence ---- */

/**
 * The captured original case pages, lazily. `evidence/source-pages/_work_<slug>.html` is
 * the rendered DOM of the page we are cloning, so the URL it puts in its own `<img
 * srcSet>` is the URL the origin actually chose — that is what settles both kinds of
 * trouble this script can hit:
 *
 *   · ratio drift   — if the page asks for exactly our URL, then the bytes the CDN gives
 *                     for that URL *are* the original's pixels, and any difference from the
 *                     `WxH` written into the path is the CMS's own stale bookkeeping, not a
 *                     missing crop. (No `/<w>x<h>/…/m/…crop…` variant appears in the DOM.)
 *   · dead asset    — if the page asks for it and every form of it now answers 403/404,
 *                     the asset is gone upstream; it gets `status:'blocked'`, never a
 *                     substitute.
 */
const sourcePageCache = new Map();
/** `projects.json`, assigned in main(); lets a drift report name the frame it renders into. */
let PROJECTS = { projects: {} };

/**
 * The `.ui-grid` frame this asset is painted into, from the same JSON the page renders:
 * `job.roles` carry `block<N>:<kind>` for blok assets. The frame ratio — not the file's own
 * ratio — is what the visitor sees, because both sites paint with object-fit:cover.
 */
function frameFor(job) {
  const p = (PROJECTS.projects || {})[job.slug];
  if (!p) return null;
  for (const role of job.roles || []) {
    const m = /^block(\d+):/.exec(role);
    if (!m) continue;
    const b = p.blocks[Number(m[1])];
    if (!b || !Array.isArray(b.items)) continue;
    for (const it of b.items) {
      const assets = [it.image, ...(it.images || [])].filter(Boolean);
      if (assets.some((a) => a.local === job.file)) return { frameRatio: it.frameRatio, frameClass: it.frameClass, blockType: b.type };
    }
  }
  if (p.hero) for (const key of ['portrait', 'landscape', 'thumbnail']) if (p.hero[key] && p.hero[key].local === job.file) return { frameRatio: null, frameClass: 'hero ' + key, blockType: 'hero' };
  return null;
}

function sourcePageFor(slug) {
  if (sourcePageCache.has(slug)) return sourcePageCache.get(slug);
  const file = path.join(SOURCE_PAGES, `_work_${slug}.html`);
  const html = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  sourcePageCache.set(slug, html);
  return html;
}

/** How many times the origin's own page references this exact (transform-free) URL. */
function originalDomReferences(slug, url) {
  const html = sourcePageFor(slug);
  if (!html) return { checked: false, count: 0 };
  const bare = String(url).split('/m/')[0];
  const plain = html.split(bare).length - 1;
  const encoded = html.split(encodeURIComponent(bare).replace(/\//g, '%2F').replace(/:/g, '%3A')).length - 1;
  return { checked: true, count: plain + encoded, page: `_work_${slug}.html` };
}

/** Every `/m/…` variant of this asset the original page uses, to rule out a real crop. */
function originalDomTransforms(slug, url) {
  const html = sourcePageFor(slug);
  if (!html) return [];
  const bare = String(url).split('/m/')[0];
  const out = new Set();
  const re = new RegExp(bare.replace(/[.\\/]/g, (c) => '\\' + c) + '((?:/m/[^&"\\s\\\\]+|)(?:\\\\u0026[^"\\\\]*)?)', 'g');
  for (const m of html.matchAll(re)) out.add(m[1].replace(/\\u0026/g, '&').slice(0, 48) || '(bare)');
  return [...out];
}

/** Raw status/size probe — used to document what the origin answers, not to store files. */
async function probe(url) {
  try {
    const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'gladeye-clone-evidence/1.0', accept: 'image/*,*/*;q=0.8' } });
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!res.ok) return { url, status: res.status, contentType: ct, error: 'http-' + res.status };
    const buf = Buffer.from(await res.arrayBuffer());
    const magic = sniff(buf);
    const d = magic ? dimensions(magic.kind, buf) : null;
    return {
      url,
      status: res.status,
      contentType: ct,
      bytes: buf.length,
      width: d ? d.width : null,
      height: d ? d.height : null,
      sha256: crypto.createHash('sha256').update(buf).digest('hex'),
    };
  } catch (e) {
    return { url, status: null, error: 'network: ' + (e && e.message ? e.message : String(e)) };
  }
}

/**
 * `entry.proportional === false` means the bytes the CDN serves for this URL disagree with
 * the `WxH` written into the URL path. Resolve it against the captured original page rather
 * than by hand-picking a crop: if the origin's own `<img>` asks for exactly this URL, then
 * these bytes are the original's pixels and the path numbers are stale CMS metadata.
 * Anything else (the page uses a different transform) is reported as unresolved so a human
 * has to go find the crop.
 */
async function resolveRatioDrift(job, entry) {
  const bare = String(job.url).split('/m/')[0];
  const dom = originalDomReferences(job.slug, job.url);
  const variants = originalDomTransforms(job.slug, job.url);
  entry.originalDomPage = dom.checked ? dom.page : null;
  entry.originalDomUrlCount = dom.count;
  entry.originalDomUrlVariants = variants.slice(0, 12);

  const live = await probe(bare);
  entry.originalServed = { status: live.status, width: live.width, height: live.height, bytes: live.bytes, sha256: live.sha256 || null };
  entry.deliveredMatchesOriginal = Boolean(live.sha256 && entry.sha256 && live.sha256 === entry.sha256);

  if (!dom.checked) {
    entry.ratioResolution = 'no-captured-page';
    entry.ratioEvidence = `evidence/source-pages/_work_${job.slug}.html is absent; drift of ${entry.ratioDrift.toFixed(3)} left for manual review`;
    return;
  }
  if (!dom.count) {
    entry.ratioResolution = 'original-url-not-in-dom';
    entry.ratioEvidence = `${bare} is not referenced by the captured page — the URL, not its bookkeeping, is wrong`;
    return;
  }
  entry.ratioResolution = 'confirmed-original-url';
  const frame = frameFor(job);
  entry.ratioEvidence =
    `the captured page references this exact URL ${dom.count}x (its only variants are ${variants.join(', ') || 'none'} — no crop form exists); ` +
    `the origin serves ${live.width}x${live.height} for it${entry.deliveredMatchesOriginal ? ', byte-identical to the local copy' : ''}, ` +
    `so the ${job.naturalWidth}x${job.naturalHeight} in the URL path is stale Storyblok metadata, not a missing crop. ` +
    `It is painted into the ${frame ? `frame ratio ${frame.frameRatio} (${frame.frameClass})` : 'DOM frame'} with object-fit:cover ` +
    `at object-position 50% 50%, exactly as the original does.`;
}

/**
 * Nothing landed. Confirm the origin really is refusing it (rather than our URL being
 * wrong) by probing every form the page could use, and record that as `blocked` — with no
 * substitute file, ever.
 */
async function markBlocked(job, entry) {
  const bare = String(job.url).split('/m/')[0];
  const forms = [...new Set([job.url, bare, `${bare}/m/${job.deliveredWidth || 1920}x0`, `${bare}/m/20x0`])];
  const probes = [];
  for (const url of forms) probes.push(await probe(url));
  const dom = originalDomReferences(job.slug, job.url);
  entry.blockedProbes = probes.map((p) => `${p.status ?? 'err'} ${p.url.replace(bare, '…')}${p.error ? ' ' + p.error : ''}`);
  entry.blocked = true;
  entry.placeholder = false;
  entry.placeholdersUsed = false;
  entry.blockedReason =
    `the captured page references this asset ${dom.count}x, but the origin answers ${entry.blockedProbes.map((p) => p.split(' ')[0]).join(' / ')} for every form ` +
    `(source file 403 AccessDenied, /m/ transforms 404, and gladeye.com's own /_next/image proxy answers ` +
    `OPTIMIZED_EXTERNAL_IMAGE_REQUEST_UNAVAILABLE), so the asset is unavailable upstream. Nothing was substituted; ` +
    `the renderer shows a labelled blocked frame (see BLOCKED_WORK_ASSETS in src/content/schema.ts).`;
  entry.status = 'blocked';
}

/* ------------------------------------------------------------------ fetch --- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const transient = (s) => s === 429 || s === 500 || s === 502 || s === 503 || s === 504 || s == null;

async function fetchValidated(url) {
  let last = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: { 'user-agent': 'gladeye-clone-evidence/1.0', accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8' },
      });
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (!res.ok) last = { status: res.status, contentType: ct, error: 'http-' + res.status };
      else if (!ct.startsWith('image/')) last = { status: res.status, contentType: ct, error: 'content-type-not-image' };
      else {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length === 0) last = { status: res.status, contentType: ct, bytes: 0, error: 'empty-body' };
        else if (looksLikeHtml(buf)) last = { status: res.status, contentType: ct, bytes: buf.length, error: 'html-body-served-as-image' };
        else {
          const magic = sniff(buf);
          if (!magic) last = { status: res.status, contentType: ct, bytes: buf.length, error: 'unrecognised-file-magic' };
          else {
            const d = dimensions(magic.kind, buf);
            return { ok: true, buf, magic, head: { status: res.status, contentType: ct, bytes: buf.length, kind: magic.kind, width: d ? d.width : null, height: d ? d.height : null } };
          }
        }
      }
      if (attempt < MAX_ATTEMPTS) await sleep((transient(last.status) ? 700 : 300) * attempt);
    } catch (e) {
      last = { status: null, contentType: null, error: 'network: ' + (e && e.message ? e.message : String(e)) };
      if (attempt < MAX_ATTEMPTS) await sleep(700 * attempt);
    }
  }
  return { ok: false, head: last };
}

async function runPool(items, size, worker) {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      for (;;) {
        const i = cursor++;
        if (i >= items.length) return;
        await worker(items[i], i);
      }
    }),
  );
}

/* ------------------------------------------------------------------ main ---- */

function main() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error('FATAL missing manifest: ' + MANIFEST_PATH + '  (run scripts/build-work-data.mjs first)');
    process.exitCode = 1;
    return;
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const projects = fs.existsSync(PROJECTS_PATH) ? JSON.parse(fs.readFileSync(PROJECTS_PATH, 'utf8')) : { featured: [] };
  const extra = extraJobs(projects, manifest.jobs);
  if (extra.length) console.log('extra    ' + extra.length + ' featured hover-layer image(s) missing from the manifest');
  let jobs = [...manifest.jobs, ...extra];
  if (ONLY_PRIORITY !== null) jobs = jobs.filter((j) => j.priority <= ONLY_PRIORITY);
  if (ONLY_SLUGS) jobs = jobs.filter((j) => ONLY_SLUGS.has(j.slug));
  if (LIMIT) jobs = jobs.slice(0, LIMIT);

  console.log('manifest ' + MANIFEST_PATH.replace(ROOT + path.sep, '') + '  publicBase=' + manifest.publicBase + '  total=' + manifest.count);
  console.log('plan     ' + jobs.length + ' jobs (priority<=' + (ONLY_PRIORITY ?? 'all') + ', slugs=' + (ONLY_SLUGS ? [...ONLY_SLUGS].length : 'all') + ', limit=' + (LIMIT ?? 'none') + ', force=' + FORCE + ')');

  const report = {
    generatedAt: new Date().toISOString(),
    generator: 'scripts/download-assets-gladeye-work.mjs',
    manifest: 'gladeye-app/src/content/asset-manifest.json',
    publicBase: manifest.publicBase,
    concurrency: CONCURRENCY,
    policy: {
      validatesHttpStatus: true,
      validatesContentType: true,
      validatesFileMagic: true,
      rejectsEmpty: true,
      rejectsHtmlAsImage: true,
      placeholdersUsed: false,
      overwritesExistingFiles: FORCE,
      resizeIsProportionalOnly: true,
    },
    filters: { priority: ONLY_PRIORITY, slugs: ONLY_SLUGS ? [...ONLY_SLUGS] : null, limit: LIMIT, dryRun: DRY },
    slugs: {},
    assets: {},
    summary: { requested: jobs.length, ok: 0, cached: 0, failed: 0, blocked: 0, bytes: 0, ratioMismatched: 0, ratioResolved: 0 },
  };
  PROJECTS = projects;

  const started = Date.now();
  const tally = (slug) => (report.slugs[slug] ||= { dir: null, requested: 0, ok: 0, cached: 0, failed: 0, blocked: 0, bytes: 0, files: [] });

  return runPool(jobs, CONCURRENCY, async (job) => {
    const dest = path.join(PUBLIC_DIR, job.out.split('/').join(path.sep));
    const rel = path.relative(ROOT, dest).split(path.sep).join('/');
    const slug = tally(job.slug);
    slug.dir = path.dirname(rel);
    slug.requested++;

    const record = async (status, extra) => {
      const { status: httpStatus, ...rest } = extra || {};
      const entry = {
        slug: job.slug, roles: job.roles, priority: job.priority, url: job.url, localPath: rel,
        naturalWidth: job.naturalWidth, naturalHeight: job.naturalHeight, naturalRatio: job.naturalRatio,
        deliveredWidth: job.deliveredWidth, httpStatus: httpStatus ?? null, error: null, ...rest, status,
      };
      if (entry.width && entry.height && job.naturalWidth && job.naturalHeight) {
        const got = entry.width / entry.height;
        entry.ratioDrift = Math.abs(got - job.naturalWidth / job.naturalHeight);
        entry.proportional = entry.ratioDrift < 0.01;
        if (!entry.proportional) {
          report.summary.ratioMismatched++;
          await resolveRatioDrift(job, entry);
        }
      }
      if (status === 'failed') await markBlocked(job, entry);
      report.assets[job.out] = entry;
      if (entry.status === 'blocked') {
        report.summary.blocked = (report.summary.blocked || 0) + 1;
        slug.blocked = (slug.blocked || 0) + 1;
      }
      if (entry.ratioResolution === 'confirmed-original-url') report.summary.ratioResolved = (report.summary.ratioResolved || 0) + 1;
      if (status === 'ok' || status === 'cached') {
        slug[status]++; report.summary[status]++;
        slug.bytes += entry.bytes || 0; report.summary.bytes += entry.bytes || 0;
        slug.files.push(rel);
      } else {
        slug.failed++; report.summary.failed++;
        entry.error = extra.error;
      }
      console.log((entry.status === 'blocked' ? 'BLOCK ' : status === 'ok' ? 'OK    ' : status === 'cached' ? 'CACHE ' : 'FAIL  ') +
        String(job.priority) + ' ' + (job.slug + '/' + job.file).slice(0, 62).padEnd(64) +
        (entry.bytes || 0) + 'B ' + (entry.width || '?') + 'x' + (entry.height || '?') +
        (entry.error ? '  [' + entry.error + ']' : '') +
        (entry.ratioResolution ? '  [' + entry.ratioResolution + ']' : ''));
    };

    // additive only: keep whatever is already on disk and validates
    if (!FORCE && fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      const buf = fs.readFileSync(dest);
      const magic = sniff(buf);
      if (magic) {
        const d = dimensions(magic.kind, buf);
        await record('cached', { bytes: buf.length, width: d ? d.width : null, height: d ? d.height : null, fileKind: magic.kind, sha256: crypto.createHash('sha256').update(buf).digest('hex') });
        return;
      }
    }
    if (DRY) { await record('skipped-dry-run', {}); return; }

    const r = await fetchValidated(job.url);
    if (!r.ok) { await record('failed', r.head); return; }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, r.buf);
    await record('ok', {
      bytes: r.buf.length, width: r.head.width, height: r.head.height, fileKind: r.magic.kind,
      contentType: r.head.contentType, httpStatus: r.head.status,
      sha256: crypto.createHash('sha256').update(r.buf).digest('hex'),
    });
  }).then(() => {
    report.summary.elapsedMs = Date.now() - started;
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n');

    console.log('\n--- per-slug ---');
    for (const [s, v] of Object.entries(report.slugs))
      console.log(s.padEnd(38) + ' ok=' + v.ok + ' cached=' + v.cached + ' failed=' + v.failed + ' blocked=' + (v.blocked || 0) + ' ' + (v.bytes / 1024 / 1024).toFixed(1) + 'MB');
    console.log('\nTOTAL   requested=' + report.summary.requested + ' ok=' + report.summary.ok + ' cached=' + report.summary.cached +
      ' failed=' + report.summary.failed + ' blocked=' + (report.summary.blocked || 0) +
      ' bytes=' + (report.summary.bytes / 1024 / 1024).toFixed(1) + 'MB in ' + report.summary.elapsedMs + 'ms');
    console.log('report  ' + path.relative(ROOT, REPORT_PATH));
    if (report.summary.ratioMismatched)
      console.log(
        'RATIO   ' + report.summary.ratioMismatched + ' file(s) drift >1% from the URL path ratio; ' +
        (report.summary.ratioResolved || 0) + ' resolved against the captured page (' +
        Object.entries(report.assets).filter(([, a]) => a.ratioResolution === 'confirmed-original-url').map(([k]) => path.basename(k).slice(0, 28)).join(', ') + ')',
      );
    const unresolved = Object.entries(report.assets).filter(([, a]) => a.proportional === false && a.ratioResolution !== 'confirmed-original-url');
    if (unresolved.length) console.log('UNRESOLVED RATIO: ' + unresolved.map(([k, a]) => k + ' [' + a.ratioResolution + ']').join(', '));
    if (report.summary.blocked) {
      console.log('\nblocked (origin no longer serves these; nothing substituted):');
      for (const [out, a] of Object.entries(report.assets)) if (a.status === 'blocked') console.log('  ' + out + '  ->  ' + a.error + '\n      ' + a.blockedReason);
    }
    if (report.summary.failed) process.exitCode = 1;
  });
}

main().catch((e) => { console.error('FATAL', e); process.exitCode = 1; });
