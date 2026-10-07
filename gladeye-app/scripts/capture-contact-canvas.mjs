import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

// Rather than guess at the contact page's decorative layer, capture what the
// live site actually paints into that canvas and keep it as a local asset.
const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await page.goto('https://www.gladeye.com/contact', { waitUntil: 'load', timeout: 120000 });
await new Promise((r) => setTimeout(r, 9000));

const info = await page.evaluate(() => {
  const list = Array.from(document.querySelectorAll('canvas'));
  return list.map((c, i) => {
    const r = c.getBoundingClientRect();
    let kind = 'unknown';
    try {
      if (c.getContext('2d', { willReadFrequently: true })) kind = '2d-or-shared';
    } catch (e) { kind = 'err:' + e.name; }
    return { i, w: c.width, h: c.height, rect: [Math.round(r.width), Math.round(r.height), Math.round(r.top)], cls: String(c.className).slice(0, 60), parentCls: String(c.parentElement?.className).slice(0, 60), kind, engine: c.getAttribute('data-engine') };
  });
});
console.log('canvases:', JSON.stringify(info, null, 1));

for (const c of info) {
  const data = await page.evaluate(async (idx) => {
    const el = document.querySelectorAll('canvas')[idx];
    if (!el) return null;
    try {
      // force a paint into a readable copy so preserveDrawingBuffer:false still works
      const copy = document.createElement('canvas');
      copy.width = el.width; copy.height = el.height;
      const ctx = copy.getContext('2d');
      ctx.drawImage(el, 0, 0);
      const d = ctx.getImageData(0, 0, copy.width, copy.height).data;
      let nonEmpty = 0, sum = 0;
      for (let i = 3; i < d.length; i += 4) { if (d[i] > 8) nonEmpty++; }
      return { w: copy.width, h: copy.height, nonEmptyPx: nonEmpty, totalPx: copy.width * copy.height, url: copy.toDataURL('image/png') };
    } catch (e) { return { err: String(e.message).slice(0, 140) }; }
  }, c.i);
  if (!data) continue;
  console.log(`canvas[${c.i}] ->`, JSON.stringify({ ...data, url: data.url ? data.url.slice(0, 30) + '…' : undefined }));
  if (data.url && data.nonEmptyPx > 500) {
    mkdirSync('evidence/source-canvas', { recursive: true });
    writeFileSync(`evidence/source-canvas/contact-canvas-${c.i}.png`, Buffer.from(data.url.split(',')[1], 'base64'));
    console.log(`   saved evidence/source-canvas/contact-canvas-${c.i}.png (${data.nonEmptyPx} painted px)`);
  }
}

// also grab a plain screenshot of the decorative band for visual truth
await page.screenshot({ path: 'evidence/source-canvas/contact__live-viewport.png' });
await browser.close();
