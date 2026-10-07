import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://127.0.0.1:3005';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 140)));

await page.goto(BASE + '/work', { waitUntil: 'load', timeout: 120000 });
await new Promise((r) => setTimeout(r, 7000));

const probe = async (label) => {
  const rows = await page.evaluate(() => {
    const items = Array.prototype.slice.call(document.querySelectorAll('[class*="FeaturedWorkGrid_item__"]'));
    return items.slice(0, 8).map(function (it) {
      const crop = it.querySelector('[class*="item-cropper"]');
      const frame = it.querySelector('[class*="item-image"]');
      const h3 = it.querySelector('h3');
      const cr = crop ? crop.getBoundingClientRect() : null;
      const img = frame ? frame.querySelector('img') : null;
      const ifr = frame ? frame.querySelector('iframe') : null;
      const layerWrap = frame ? frame.querySelector('[class*="absolute"]') : null;
      return {
        title: h3 ? h3.textContent.trim().slice(0, 24) : '?',
        cropTop: cr ? Math.round(cr.top) : null,
        cropH: cr ? Math.round(cr.height) : null,
        cropTransform: crop ? getComputedStyle(crop).transform.slice(0, 26) : null,
        frameOpacity: frame ? getComputedStyle(frame).opacity : null,
        frameInlineOpacity: frame ? frame.style.opacity : null,
        layerChildren: frame ? frame.querySelectorAll('img, iframe, video').length : 0,
        kind: ifr ? 'iframe' : img ? 'img' : 'EMPTY',
      };
    });
  });
  console.log('---', label);
  for (const r of rows) console.log('   ', JSON.stringify(r));
};

await probe('scrollY=0');
await page.evaluate(() => window.scrollTo(0, 1930));
await new Promise((r) => setTimeout(r, 3000));
await probe('scrollY=1930');

const ticker = await page.evaluate(() => ({
  canHover: window.matchMedia('(hover: hover)').matches,
  fine: window.matchMedia('(pointer: fine)').matches,
  reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
}));
console.log('env:', JSON.stringify(ticker));
console.log('pageerrors:', errors.slice(0, 3));
await browser.close();
