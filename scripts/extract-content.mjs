import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';

const chunk = readFileSync('evidence/source-assets/js/app/page-4c279de0997d388f.js', 'utf8');
const out = [];

function around(key, before, after, max) {
  const hits = [];
  let idx = chunk.indexOf(key);
  let n = 0;
  while (idx !== -1 && n < (max || 3)) {
    hits.push({ at: idx, text: chunk.slice(Math.max(0, idx - before), idx + after) });
    idx = chunk.indexOf(key, idx + 1);
    n++;
  }
  return hits;
}

for (const k of ['bloomParams:', 'this.settings=', 'uCamFar:', 'uFlowerBloomDistance', 'uNegativeSpaceDeepness:', 'uTerrainOffsetY:', 'uPoolRows', 'new a.cPb(', 'maxPixelRatio', 'pixelDensity', 'introCameraAngle']) {
  const h = around(k, 700, 1600, 2);
  if (h.length) out.push(`\n===== [${k}] =====\n` + h.map((x) => x.text).join('\n-----\n'));
}
writeFileSync('evidence/params/scene-settings-raw.txt', out.join('\n'));

// ---- HTML content extraction ----
mkdirSync('evidence/content', { recursive: true });
const assets = new Set();
const dir = 'evidence/source-pages';
for (const f of readdirSync(dir)) {
  const html = readFileSync(`${dir}/${f}`, 'utf8');
  const route = '/' + f.replace(/^_/, '').replace(/\.html$/, '').replace(/_/g, '/');
  const imgRe = /<img[^>]*>/g;
  const imgs = [];
  let m;
  while ((m = imgRe.exec(html))) {
    const tag = m[0];
    const get = (a) => { const r = new RegExp(`${a}="([^"]*)"`).exec(tag); return r ? r[1] : null; };
    let src = get('src') || '';
    const um = /url=([^&"]*)&w=/.exec(src) || /url=([^&]*)/.exec(src);
    if (src.includes('/_next/image') && um) { try { src = decodeURIComponent(um[1]); } catch {} }
    if (src.includes('storyblok')) [...src.matchAll(/https?:\/\/[^"' ]+/g)].forEach((u) => assets.add(u));
    imgs.push({ src, alt: get('alt'), w: get('width'), h: get('height'), cls: get('class'), style: get('style') });
    assets.add(src);
  }
  const vids = [...html.matchAll(/<video[^>]*>[\s\S]{0,900}?<\/video>/g)].map((v) => v[0]);
  const bgUrls = [...html.matchAll(/https?:\/\/[^"'() ]*storyblok[^"'() ]*/g)].map((x) => x[0]);
  bgUrls.forEach((u) => assets.add(u));
  const headings = [...html.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/g)].map((h) => ({ level: +h[1], html: h[2].trim().slice(0, 400), text: h[2].replace(/<[^>]+>/g, '').trim().slice(0, 300) }));
  const paragraphs = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((p) => ({ html: p[1].trim().slice(0, 600), text: p[1].replace(/<[^>]+>/g, '').trim().slice(0, 500) })).filter((p) => p.text.length);
  const links = [...html.matchAll(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map((l) => ({ href: l[1], text: l[2].replace(/<[^>]+>/g, '').trim().slice(0, 120), cls: (/class="([^"]*)"/.exec(l[0]) || [])[1] }));
  const svgs = [...html.matchAll(/<svg[\s\S]*?<\/svg>/g)].map((s) => s[0]);
  const themes = [...new Set([...html.matchAll(/--theme-[a-z-]+:[^;"]*/g)].map((x) => x[0]))];
  const body = { route, imgs, vids, headings, paragraphs, links: links.slice(0, 200), svgCount: svgs.length, svgs: svgs.slice(0, 12), themes, title: (/\/title>([^<]*)/.exec(html) || [])[1] };
  writeFileSync(`evidence/content/${f.replace('.html', '')}.json`, JSON.stringify(body, null, 1));
  writeFileSync(`evidence/content/${f.replace('.html', '')}.svgs.json`, JSON.stringify(svgs, null, 1));
}
writeFileSync('evidence/content/_asset-urls.json', JSON.stringify([...assets].sort(), null, 1));
console.log('scene-settings raw chars:', out.join('\n').length, '| asset urls:', assets.size);
console.log('content files:', readdirSync('evidence/content').length);
