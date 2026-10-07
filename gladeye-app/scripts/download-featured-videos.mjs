import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

// Only the /work featured covers are fetched here: they are the video layers the
// grid renders first, and without them those panels fall back to an error state.
// The 166 case-body videos are deliberately NOT scraped (volume + third-party
// rights); they stay documented in docs/asset-rights.md.
const KINDS = (process.env.KINDS || 'featured').split(',');
const CONCURRENCY = Number(process.env.CONCURRENCY || 3);

const manifest = JSON.parse(readFileSync('src/content/video-manifest.json', 'utf8'));
const all = Array.isArray(manifest) ? manifest : manifest.videos;
const wanted = all.filter((v) => KINDS.includes(v.kind) && /^https/.test(v.source || ''));

async function fetchOne(v) {
  const dest = join('public', v.out);
  if (existsSync(dest) && statSync(dest).size > 100_000) {
    return { slug: v.slug, kind: v.kind, out: v.out, status: 'cached', bytes: statSync(dest).size };
  }
  mkdirSync(dirname(dest), { recursive: true });
  const res = await fetch(v.source, { redirect: 'follow' });
  if (!res.ok || !res.body) return { slug: v.slug, kind: v.kind, out: v.out, status: `http-${res.status}` };
  const ct = res.headers.get('content-type') || '';
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
  const bytes = statSync(dest).size;
  const fd = readFileSync(dest).subarray(4, 12).toString('latin1');
  const isMp4 = fd.includes('ftyp');
  if (!isMp4) {
    return { slug: v.slug, kind: v.kind, out: v.out, status: 'bad-magic', bytes, contentType: ct };
  }
  return { slug: v.slug, kind: v.kind, out: v.out, status: 'ok', bytes, contentType: ct };
}

const results = [];
let cursor = 0;
async function worker() {
  while (cursor < wanted.length) {
    const i = cursor++;
    try {
      results[i] = await fetchOne(wanted[i]);
    } catch (e) {
      results[i] = { slug: wanted[i].slug, kind: wanted[i].kind, out: wanted[i].out, status: 'error', err: String(e.message).slice(0, 160) };
    }
    console.log(`[${results.length}/${wanted.length}] ${results[i].status} ${results[i].out}`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const ok = results.filter((r) => r.status === 'ok' || r.status === 'cached').length;
const bytes = results.reduce((s, r) => s + (r.bytes || 0), 0);
writeFileSync('../evidence/video-download-report.json', JSON.stringify({ kinds: KINDS, requested: wanted.length, ok, failed: results.length - ok, bytes, results }, null, 1));
console.log(`\nDONE ok=${ok}/${wanted.length} bytes=${(bytes / 1048576).toFixed(1)}MB`);
for (const r of results.filter((x) => x.status !== 'ok' && x.status !== 'cached')) console.log('  FAIL', r.slug, r.kind, r.status, r.err || '');
