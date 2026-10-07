import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { PNG } from 'pngjs';
import zlib from 'node:zlib';

// Three-up comparison: reference | candidate | 50% overlay + diff stats.
// Refuses to score shots whose dimensions disagree with the reference, and
// flags all-black / all-flat candidates instead of letting them pass.
const REF = process.env.REF_DIR || 'docs/design-references/gladeye';
const CAN = process.env.CAN_DIR || 'docs/candidates/gladeye';
const LABEL = process.env.LABEL || 'current';
const OUT = process.env.OUT_DIR || 'reports/comparisons';
mkdirSync(OUT, { recursive: true });

function load(p) { return PNG.sync.read(readFileSync(p)); }

function stats(img) {
  let sum = 0, sum2 = 0, min = 255, max = 0, uniq = new Set();
  for (let i = 0; i < img.data.length; i += 4 * 97) {
    const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    sum += l; sum2 += l * l; if (l < min) min = l; if (l > max) max = l;
    if (uniq.size < 4000) uniq.add((r >> 3) << 10 | (g >> 3) << 5 | (b >> 3));
  }
  const n = Math.floor(img.data.length / (4 * 97));
  const mean = sum / n;
  return { meanLuma: +mean.toFixed(2), stdev: +Math.sqrt(sum2 / n - mean * mean).toFixed(2), min: +min.toFixed(1), max: +max.toFixed(1), uniqueColors: uniq.size };
}

function compare(ref, can) {
  const w = Math.min(ref.width, can.width), h = Math.min(ref.height, can.height);
  let diffSum = 0, over = 0, big = 0;
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ri = (ref.width * y + x) << 2;
      const ci = (can.width * y + x) << 2;
      const oi = (w * y + x) << 2;
      const dr = Math.abs(ref.data[ri] - can.data[ci]);
      const dg = Math.abs(ref.data[ri + 1] - can.data[ci + 1]);
      const db = Math.abs(ref.data[ri + 2] - can.data[ci + 2]);
      const d = (dr + dg + db) / 3;
      diffSum += d;
      if (d > 12) over++;
      if (d > 60) big++;
      out.data[oi] = (ref.data[ri] + can.data[ci]) / 2;
      out.data[oi + 1] = (ref.data[ri + 1] + can.data[ci + 1]) / 2;
      out.data[oi + 2] = (ref.data[ri + 2] + can.data[ci + 2]) / 2;
      out.data[oi + 3] = 255;
      if (d > 60) { out.data[oi] = 255; out.data[oi + 1] = 0; out.data[oi + 2] = 0; }
    }
  }
  const total = w * h;
  return { meanAbsDiff: +(diffSum / total).toFixed(2), pctPixelsOver12: +((over / total) * 100).toFixed(2), pctPixelsOver60: +((big / total) * 100).toFixed(2), size: [w, h] };
}

const canFiles = existsSync(CAN) ? readdirSync(CAN).filter((f) => f.startsWith(LABEL + '__') && f.endsWith('.png')) : [];
const rows = [];
for (const cf of canFiles) {
  const key = cf.slice(LABEL.length + 2).replace(/\.png$/, '');
  const refPath = `${REF}/${key}.png`;
  const canPath = `${CAN}/${cf}`;
  if (!existsSync(refPath)) { rows.push({ key, status: 'no-reference' }); continue; }
  const ref = load(refPath), can = load(canPath);
  const rs = stats(ref), cs = stats(can);
  const dimsMatch = ref.width === can.width && ref.height === can.height;
  const c = dimsMatch ? compare(ref, can) : { meanAbsDiff: null, pctPixelsOver12: null, pctPixelsOver60: null, size: [can.width, can.height] };
  const flags = [];
  if (!dimsMatch) flags.push(`DIM-MISMATCH ref=${ref.width}x${ref.height} can=${can.width}x${can.height}`);
  if (cs.stdev < 4) flags.push(cs.meanLuma < 12 ? 'FLAT-BLACK' : 'FLAT-FILL');
  if (cs.uniqueColors < 200) flags.push('LOW-COLOR-COUNT(fallback?)');
  writeFileSync(`${OUT}/${key}__overlay.png`, PNG.sync.write(new PNG({ width: c.size[0], height: c.size[1], data: (() => { const p = new PNG({ width: c.size[0], height: c.size[1] }); let diffSum = 0; for (let y = 0; y < c.size[1]; y++) for (let x = 0; x < c.size[0]; x++) { const ri = (ref.width * y + x) << 2, ci = (can.width * y + x) << 2, oi = (p.width * y + x) << 2; const d = (Math.abs(ref.data[ri] - can.data[ci]) + Math.abs(ref.data[ri + 1] - can.data[ci + 1]) + Math.abs(ref.data[ri + 2] - can.data[ci + 2])) / 3; diffSum += d; p.data[oi] = d > 60 ? 255 : (ref.data[ri] + can.data[ci]) / 2; p.data[oi + 1] = d > 60 ? 0 : (ref.data[ri + 1] + can.data[ci + 1]) / 2; p.data[oi + 2] = d > 60 ? 0 : (ref.data[ri + 2] + can.data[ci + 2]) / 2; p.data[oi + 3] = 255; } return p.data; })() })));
  rows.push({ key, status: dimsMatch ? 'compared' : 'dim-mismatch', ref: rs, candidate: cs, ...c, flags });
}

rows.sort((a, b) => (b.meanAbsDiff || 0) - (a.meanAbsDiff || 0));
const md = ['# Visual comparison — ' + LABEL, '', '| state | meanAbsDiff | %px>12 | %px>60 | ref luma/σ | cand luma/σ | cand colors | flags |', '|---|---|---|---|---|---|---|---|'];
for (const r of rows) {
  md.push(`| ${r.key} | ${r.meanAbsDiff ?? '—'} | ${r.pctPixelsOver12 ?? '—'} | ${r.pctPixelsOver60 ?? '—'} | ${r.ref ? r.ref.meanLuma + '/' + r.ref.stdev : '—'} | ${r.candidate ? r.candidate.meanLuma + '/' + r.candidate.stdev : '—'} | ${r.candidate ? r.candidate.uniqueColors : '—'} | ${(r.flags || []).join(' ') || r.status} |`);
}
writeFileSync(`${OUT}/report-${LABEL}.md`, md.join('\n') + '\n');
writeFileSync(`${OUT}/report-${LABEL}.json`, JSON.stringify(rows, null, 1));
console.log(md.join('\n'));
console.log('\ncompared:', rows.filter((r) => r.status === 'compared').length, '/', rows.length);
