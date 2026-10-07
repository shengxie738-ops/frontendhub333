#!/usr/bin/env node
/**
 * download-assets-gladeye-info.mjs
 *
 * Downloads every Storyblok image used by the /about, /contact and /careers pages
 * of the Gladeye clone, straight from the URLs recorded in
 *   evidence/content/_about.json, _contact.json, _careers.json
 * (and mirrored into gladeye-app/src/content/{about,contact,careers}.json).
 *
 * Rules enforced (per the clone brief):
 *   - max 4 concurrent downloads
 *   - validate HTTP status, Content-Type, real file magic and non-empty body
 *   - never persist an HTML error page as an image
 *   - never substitute a placeholder/generated image
 *   - emit evidence/asset-report-info.json  (url -> localPath/sha256/bytes/width/height/status)
 *
 * Usage:  node scripts/download-assets-gladeye-info.mjs [--force]
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..'); // repo root (D:/前端素材页面22)
const APP = path.join(ROOT, 'gladeye-app');
const PUBLIC_DIR = path.join(APP, 'public', 'sites', 'gladeye');
const CONTENT_DIR = path.join(APP, 'src', 'content');
const EVIDENCE_DIR = path.join(ROOT, 'evidence', 'content');
const REPORT_PATH = path.join(ROOT, 'evidence', 'asset-report-info.json');

const CONCURRENCY = 4;
const MAX_ATTEMPTS = 3;
const FORCE = process.argv.includes('--force');

const PAGES = ['about', 'contact', 'careers'];

/* ------------------------------------------------------------------ *
 * 1. Collect the image URLs each page actually renders
 * ------------------------------------------------------------------ */

/** Strip Storyblok's own resize filters so we fetch the source pixels. */
function toSourceUrl(src) {
  if (!src) return null;
  let s = src.trim();
  if (!s.startsWith('http')) return null;
  // /m/20x0 (LQIP) and /m/<w>x<h> filters are suffixes on the asset path
  s = s.replace(/\/m\/[0-9]+x[0-9]+(x[0-9]+)?(\/filters:[^?]*)?$/, '');
  return s;
}

/** The blur-up placeholder layer the original site requests. */
function toLqipUrl(src) {
  return src + '/m/20x0';
}

function storyblokFilename(url) {
  // https://a-us.storyblok.com/f/1014779/4032x3024/5077b19f33/img_0720.jpg
  // pathname segments: f / space / dims / hash / name
  const parts = new URL(url).pathname.split('/').filter(Boolean);
  if (parts.length < 5) return null;
  const dims = parts[parts.length - 3]; // 4032x3024
  const hash = parts[parts.length - 2]; // 5077b19f33
  const name = parts[parts.length - 1]; // img_0720.jpg
  return { dims, hash, name, stem: name.replace(/\.[^.]+$/, ''), ext: (name.match(/\.[^.]+$/) || ['.jpg'])[0] };
}

/** Lowercase, extension-safe local file name: <storyblok-hash>_<stem><ext> */
function localName(url) {
  const f = storyblokFilename(url);
  if (!f) return 'asset' + crypto.createHash('sha1').update(url).digest('hex').slice(0, 10) + '.jpg';
  return (f.hash + '_' + f.stem).toLowerCase().replace(/[^a-z0-9._-]/g, '-') + f.ext.toLowerCase();
}

/** 20x0 blur-up layer: <dims>_<stem>.20x0.jpg */
function localNameLqip(sourceUrl) {
  return localName(sourceUrl).replace(/\.[^.]+$/, '') + '.20x0.jpg';
}

function collectJobs() {
  const jobs = [];
  const seen = new Set();
  for (const page of PAGES) {
    const evPath = path.join(EVIDENCE_DIR, '_' + page + '.json');
    if (!fs.existsSync(evPath)) {
      console.warn('WARN  missing evidence file: ' + evPath);
      continue;
    }
    const doc = JSON.parse(fs.readFileSync(evPath, 'utf8'));
    const urls = [];
    for (const im of doc.imgs || []) {
      const s = toSourceUrl(im.src);
      if (s && !urls.includes(s)) urls.push(s);
    }
    // fall back to the content JSON when the parsed evidence carries no imgs
    if (urls.length === 0) {
      const cPath = path.join(CONTENT_DIR, page + '.json');
      if (fs.existsSync(cPath)) {
        const c = JSON.parse(fs.readFileSync(cPath, 'utf8'));
        const bag = [];
        const walk = (n) => {
          if (Array.isArray(n)) n.forEach(walk);
          else if (n && typeof n === 'object') {
            if (typeof n.filename === 'string' && n.filename.startsWith('http')) bag.push(n.filename);
            Object.values(n).forEach(walk);
          }
        };
        walk(c);
        for (const raw of bag) {
          const s = toSourceUrl(raw);
          if (s && !urls.includes(s)) urls.push(s);
        }
      }
    }
    urls.forEach((u, order) => {
      const key = page + '|' + u;
      if (seen.has(key)) return;
      seen.add(key);
      jobs.push({ page, url: u, order, kind: 'full' });
      jobs.push({ page, url: toLqipUrl(u), order, kind: 'lqip', sourceUrl: u });
    });
    console.log('plan  /' + page + ': ' + urls.length + ' unique source images');
  }
  return jobs;
}

/* ------------------------------------------------------------------ *
 * 2. Binary validation: status / content-type / magic / dimensions
 * ------------------------------------------------------------------ */

const MAGIC = [
  { kind: 'jpeg', test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff, ext: '.jpg' },
  { kind: 'png', test: (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47, ext: '.png' },
  { kind: 'gif', test: (b) => b.length > 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46, ext: '.gif' },
  { kind: 'webp', test: (b) => b.length > 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP', ext: '.webp' },
  { kind: 'avif', test: (b) => b.length > 12 && b.subarray(4, 8).toString('latin1') === 'ftyp' && /avif|avis/.test(b.subarray(8, 12).toString('latin1')), ext: '.avif' },
];

function sniff(buf) {
  for (const m of MAGIC) if (m.test(buf)) return m;
  return null;
}

/** Reject anything that is actually an HTML error body, even with a 200. */
function looksLikeHtml(buf) {
  const head = buf.subarray(0, 512).toString('latin1').trimStart().toLowerCase();
  return head.startsWith('<!doctype html') || head.startsWith('<html') || head.startsWith('<head') || head.startsWith('<?xml');
}

function jpegSize(buf) {
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    const len = (buf[i + 2] << 8) | buf[i + 3];
    // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15 carry the frame size
    const isSof = (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf);
    if (isSof) return { width: (buf[i + 7] << 8) | buf[i + 8], height: (buf[i + 5] << 8) | buf[i + 6] };
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    i += 2 + len;
  }
  return null;
}

function pngSize(buf) {
  if (buf.length < 24) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function gifSize(buf) {
  if (buf.length < 10) return null;
  return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
}

function webpSize(buf) {
  const tag = buf.subarray(12, 16).toString('latin1');
  if (tag === 'VP8L') {
    const n = buf.readUInt32LE(21);
    return { width: (n & 0x3fff) + 1, height: ((n >> 14) & 0x3fff) + 1 };
  }
  if (tag === 'VP8X') return { width: 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16)), height: 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16)) };
  if (tag === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  return null;
}

function dimensions(kind, buf) {
  try {
    if (kind === 'jpeg') return jpegSize(buf);
    if (kind === 'png') return pngSize(buf);
    if (kind === 'gif') return gifSize(buf);
    if (kind === 'webp') return webpSize(buf);
  } catch {
    return null;
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * 3. Fetch with bounded concurrency and retries
 * ------------------------------------------------------------------ */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchValidated(url) {
  let last = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: { 'user-agent': 'gladeye-clone-evidence/1.0', accept: 'image/*,*/*;q=0.8' },
      });
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      const lengthHeader = res.headers.get('content-length');
      if (!res.ok) {
        last = { status: res.status, statusText: res.statusText, contentType: ct, error: 'http-' + res.status };
      } else if (!ct.startsWith('image/')) {
        last = { status: res.status, contentType: ct, error: 'content-type-not-image' };
      } else {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length === 0) {
          last = { status: res.status, contentType: ct, bytes: 0, error: 'empty-body' };
        } else if (looksLikeHtml(buf)) {
          last = { status: res.status, contentType: ct, bytes: buf.length, error: 'html-body-served-as-image' };
        } else {
          const magic = sniff(buf);
          if (!magic) {
            last = { status: res.status, contentType: ct, bytes: buf.length, error: 'unrecognised-file-magic' };
          } else {
            const head = {
              status: res.status,
              contentType: ct,
              bytes: buf.length,
              kind: magic.kind,
              magicOk: true,
              declaredLength: lengthHeader ? Number(lengthHeader) : null,
              width: null,
              height: null,
            };
            const d = dimensions(magic.kind, buf);
            if (d && d.width > 0 && d.height > 0) { head.width = d.width; head.height = d.height; }
            return { ok: true, buf, head, magicExt: magic.ext };
          }
        }
      }
      if (magicTransient(last.status)) await sleep(400 * attempt);
      else if (attempt < MAX_ATTEMPTS) await sleep(300 * attempt);
    } catch (e) {
      last = { status: null, contentType: null, error: 'network: ' + (e && e.message ? e.message : String(e)) };
      if (attempt < MAX_ATTEMPTS) await sleep(400 * attempt);
    }
  }
  return { ok: false, head: last };
}

const magicTransient = (s) => s === 429 || s === 500 || s === 502 || s === 503 || s === 504 || s == null;

async function runPool(items, size, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

/* ------------------------------------------------------------------ *
 * 4. Main
 * ------------------------------------------------------------------ */

function main() {
  const jobs = collectJobs();
  console.log('plan  ' + jobs.length + ' downloads at concurrency ' + CONCURRENCY);

  const report = {
    generatedAt: new Date().toISOString(),
    generator: 'scripts/download-assets-gladeye-info.mjs',
    concurrency: CONCURRENCY,
    policy: {
      validatesHttpStatus: true,
      validatesContentType: true,
      validatesFileMagic: true,
      rejectsEmpty: true,
      rejectsHtmlAsImage: true,
      placeholdersUsed: false,
    },
    pages: {},
    assets: {},
    summary: { requested: jobs.length, ok: 0, failed: 0, bytes: 0, byPage: {} },
  };

  for (const p of PAGES) {
    report.pages[p] = { dir: 'gladeye-app/public/sites/gladeye/' + p, files: [], requested: 0, ok: 0, failed: 0 };
  }

  const started = Date.now();
  return runPool(jobs, CONCURRENCY, async (job) => {
    const dir = path.join(PUBLIC_DIR, job.page);
    fs.mkdirSync(dir, { recursive: true });
    const file = job.kind === 'lqip' ? localNameLqip(job.sourceUrl) : localName(job.url);
    const dest = path.join(dir, file);
    const rel = path.relative(ROOT, dest).split(path.sep).join('/');

    if (!FORCE && fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      const buf = fs.readFileSync(dest);
      const magic = sniff(buf);
      if (magic) {
        const d = dimensions(magic.kind, buf);
        const head = {
          status: 'cached', contentType: 'image/' + (magic.kind === 'jpeg' ? 'jpeg' : magic.kind),
          bytes: buf.length, kind: magic.kind, magicOk: true,
          width: d ? d.width : null, height: d ? d.height : null,
        };
        finish(job, rel, buf, head, dest, 'cached');
        return;
      }
    }

    const r = await fetchValidated(job.url);
    if (!r.ok) {
      finish(job, null, null, r.head, null, 'failed', r.head.error);
      return;
    }
    // The extension we chose must agree with what the bytes actually are.
    const expectedExt = path.extname(dest).toLowerCase();
    const actualExt = r.magicExt;
    let finalDest = dest;
    if (expectedExt !== actualExt && !(expectedExt === '.jpg' && actualExt === '.jpg')) {
      finalDest = dest.replace(/\.[^.]+$/, actualExt);
    }
    fs.writeFileSync(finalDest, r.buf);
    const sha256 = crypto.createHash('sha256').update(r.buf).digest('hex');
    r.head.sha256 = sha256;
    finish(job, path.relative(ROOT, finalDest).split(path.sep).join('/'), r.buf, r.head, finalDest, 'ok');
  }).then(() => {
    report.summary.elapsedMs = Date.now() - started;
    for (const p of PAGES) {
      report.summary.byPage[p] = { requested: report.pages[p].requested, ok: report.pages[p].ok, failed: report.pages[p].failed, bytes: report.pages[p].bytes };
    }
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n');
    console.log('\n--- summary ---');
    for (const p of PAGES) {
      const pg = report.pages[p];
      console.log(p.padEnd(8) + ' ok=' + pg.ok + ' failed=' + pg.failed + ' bytes=' + ((pg.bytes || 0) / 1024 / 1024).toFixed(2) + 'MB');
    }
    console.log('TOTAL   ok=' + report.summary.ok + ' failed=' + report.summary.failed + ' bytes=' + (report.summary.bytes / 1024 / 1024).toFixed(2) + 'MB in ' + report.summary.elapsedMs + 'ms');
    console.log('report  ' + path.relative(ROOT, REPORT_PATH));
    if (report.summary.failed > 0) {
      console.log('\nfailures:');
      for (const [url, a] of Object.entries(report.assets)) if (a.status !== 'ok' && a.status !== 'cached') console.log('  ' + url + '  ->  ' + a.error);
      process.exitCode = 1;
    }
  });

  function finish(job, localPath, buf, head, dest, status, error) {
    const pg = report.pages[job.page];
    pg.requested++;
    const entry = {
      page: job.page,
      kind: job.kind,
      localPath,
      sha256: head && head.sha256 ? head.sha256 : buf ? crypto.createHash('sha256').update(buf).digest('hex') : null,
      bytes: head ? head.bytes : null,
      width: head ? head.width : null,
      height: head ? head.height : null,
      contentType: head ? head.contentType : null,
      httpStatus: head ? head.status : null,
      fileKind: head ? head.kind : null,
      status,
      error: error || null,
    };
    report.assets[job.url] = entry;
    if (status === 'ok' || status === 'cached') {
      pg.ok++;
      report.summary.ok++;
      pg.bytes = (pg.bytes || 0) + (entry.bytes || 0);
      report.summary.bytes += entry.bytes || 0;
      pg.files.push(localPath);
    } else {
      pg.failed++;
      report.summary.failed++;
    }
    console.log((status === 'ok' || status === 'cached' ? 'OK   ' : 'FAIL ') + job.page + '/' + job.kind + ' ' + (entry.bytes || 0) + 'B ' + (entry.width || '?') + 'x' + (entry.height || '?') + ' ' + job.url.replace('https://a-us.storyblok.com/f/1014779/', '') + (error ? '  [' + error + ']' : ''));
  }
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exitCode = 1;
});
