import { chromium } from 'playwright';

// A jump-scroll can outrun both the lazy image loader and the reveal spring, so
// a single 50% screenshot can read as "blank" for reasons that are not layout
// bugs. This walks to the mark gradually, waits for images, then reports.
const BASE = process.env.BASE || 'http://127.0.0.1:3005';
const ROUTE = process.env.ROUTE || '/work';
const MARK = Number(process.env.MARK || 50);
const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

await page.goto(BASE + ROUTE, { waitUntil: 'load', timeout: 120000 });
await new Promise((r) => setTimeout(r, 6000));
const docH = await page.evaluate(() => document.documentElement.scrollHeight);
const target = Math.round((docH - 900) * (MARK / 100));

// walk down in viewport-sized steps so every lazy section is visited
for (let y = 0; y <= target; y += 450) {
  await page.evaluate((v) => window.scrollTo(0, v), y);
  await new Promise((r) => setTimeout(r, 260));
}
await page.evaluate((v) => window.scrollTo(0, v), target);
await new Promise((r) => setTimeout(r, 2500));
await page.evaluate(() => new Promise((res) => {
  const imgs = Array.from(document.images);
  if (!imgs.length) return res();
  let left = imgs.length;
  const done = () => { if (--left <= 0) res(); };
  imgs.forEach((i) => { if (i.complete) done(); else { i.addEventListener('load', done); i.addEventListener('error', done); } });
  setTimeout(res, 6000);
}));
await new Promise((r) => setTimeout(r, 1500));

const d = await page.evaluate(() => {
  const inView = Array.from(document.querySelectorAll('img, iframe, video')).filter((el) => {
    const r = el.getBoundingClientRect();
    return r.top < innerHeight && r.bottom > 0 && r.width > 40 && r.height > 40;
  });
  const painted = inView.filter((el) => {
    let e = el;
    while (e && e !== document.body) {
      if (Number(getComputedStyle(e).opacity) < 0.05) return false;
      e = e.parentElement;
    }
    return true;
  });
  return {
    mediaInView: inView.length,
    mediaPainted: painted.length,
    hiddenAncestors: inView.filter((el) => !painted.includes(el)).map((el) => {
      let e = el;
      while (e && e !== document.body) {
        const o = Number(getComputedStyle(e).opacity);
        if (o < 0.05) return e.tagName + '.' + String(e.className).slice(0, 44) + ' op=' + o;
        e = e.parentElement;
      }
      return 'unknown';
    }).slice(0, 6),
    scrollY: Math.round(window.scrollY),
  };
});
console.log(`docH=${docH} target=${target} ->`, JSON.stringify(d, null, 1));
await page.screenshot({ path: `docs/candidates/gladeye/walk__${ROUTE.replace(/[^\w]/g, '_')}__${MARK}.png` });
await browser.close();
