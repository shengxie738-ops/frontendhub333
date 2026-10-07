import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

// Pins the capture environment: the reference site silently changes behaviour
// under software WebGL, so the probe values are recorded next to every shot.
const VIEWPORT = { width: Number(process.env.VW || 1440), height: Number(process.env.VH || 900) };
const OUT = process.env.OUT_DIR || 'docs/design-references/gladeye';
const BASE = 'https://www.gladeye.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  channel: 'msedge',
  headless: process.env.HEADED !== '1',
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1, locale: 'en-US', reducedMotion: 'no-preference' });

const env = {
  viewport: VIEWPORT,
  deviceScaleFactor: 1,
  headless: process.env.HEADED !== '1',
  channel: 'msedge',
  userAgent: null,
  webgl: null,
  startedAt: new Date().toISOString(),
  shots: [],
};

async function shot(name, opts = {}) {
  await page.screenshot({ path: `${OUT}/${name}.png`, ...opts });
  env.shots.push(name);
  console.log('shot:', name);
}

async function probe() {
  return page.evaluate(() => {
    const c = document.querySelector('canvas');
    let gl = null, renderer = null;
    if (c) { try { const g = c.getContext('webgl2'); if (g) { const d = g.getExtension('WEBGL_debug_renderer_info'); renderer = d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); } } catch {} }
    return {
      canvasPresent: !!c, canvasRect: c ? [c.width, c.height] : null,
      engine: c ? c.getAttribute('data-engine') : null, rendererString: renderer,
      scrollHeight: document.documentElement.scrollHeight, innerH: innerHeight,
      bodyPosition: getComputedStyle(document.body).position,
    };
  });
}

// ---------- HOME ----------
await page.goto(BASE + '/', { waitUntil: 'load', timeout: 120000 });
await sleep(9000); // let the valley load + intro camera settle
env.userAgent = await page.evaluate(() => navigator.userAgent);
env.homeProbe = await probe();
await shot('home__00_intro');
await sleep(6000);
await shot('home__01_stable');

for (const [px, py] of [[0.5, 0.5], [0.12, 0.2], [0.88, 0.2], [0.88, 0.85], [0.12, 0.85]]) {
  await page.mouse.move(px * VIEWPORT.width, py * VIEWPORT.height);
  await sleep(1400);
  await shot(`home__pointer-${px}-${py}`);
}

// virtual-scroll journey: wheel accumulates into camera progress (no native scroll)
for (const step of [1, 2, 3, 4, 5, 6, 8, 10]) {
  for (let i = 0; i < step; i++) { await page.mouse.wheel(0, 620); await sleep(45); }
  await sleep(2200);
  await shot(`home__scroll-x${step}`);
  env[`scrollProbe_x${step}`] = await probe();
}
await shot('home__full', { fullPage: true });

// ---------- MENU ----------
await page.goto(BASE + '/', { waitUntil: 'load' });
await sleep(7000);
const menuBtn = page.locator('button', { hasText: 'Menu' }).first();
if (await menuBtn.count()) {
  await menuBtn.click();
  await sleep(1200); await shot('menu__open');
  const items = await page.locator('[class*="Menu"] a, [class*="menu"] a').allTextContents();
  env.menuItems = items.filter(Boolean).slice(0, 30);
  const first = page.locator('[class*="Menu"] a, [class*="menu"] a').first();
  if (await first.count()) { await first.hover(); await sleep(700); await shot('menu__hover-item'); }
  await page.keyboard.press('Escape'); await sleep(500); await shot('menu__closing-mid');
  await sleep(1200);
}

// ---------- STATIC PAGES ----------
for (const route of ['/work', '/about', '/contact', '/careers']) {
  const key = route === '/work' ? 'work' : route.slice(1);
  await page.goto(BASE + route, { waitUntil: 'load', timeout: 120000 });
  await sleep(6000);
  await shot(`${key}__0_top`);
  const h = await page.evaluate(() => document.body.scrollHeight);
  const marks = [0.25, 0.5, 0.75, 1];
  for (const m of marks) {
    await page.evaluate((y) => window.scrollTo(0, y), Math.max(0, Math.round((h - VIEWPORT.height) * m)));
    await sleep(1600);
    await shot(`${key}__${Math.round(m * 100)}pct`);
  }
  await shot(`${key}__full`, { fullPage: true });
}

// ---------- CASE STUDIES ----------
const cases = process.env.CASES
  ? process.env.CASES.split(',')
  : ['into-the-amazon', 'cyberbrokers', 'ekos-genesis', 'the-virtual-economy', 'hypercinema'];
for (const slug of cases) {
  await page.goto(`${BASE}/work/${slug}`, { waitUntil: 'load', timeout: 120000 });
  await sleep(6000);
  await shot(`case-${slug}__hero`);
  const h = await page.evaluate(() => document.body.scrollHeight);
  for (const m of [0.25, 0.5, 0.75]) {
    await page.evaluate((y) => window.scrollTo(0, y), Math.round((h - VIEWPORT.height) * m));
    await sleep(1500);
    await shot(`case-${slug}__${Math.round(m * 100)}pct`);
  }
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await sleep(1500);
  await shot(`case-${slug}__bottom`);
  await shot(`case-${slug}__full`, { fullPage: true });
}

await browser.close();
writeFileSync(`${OUT}/_capture-environment.json`, JSON.stringify(env, null, 1));
console.log('DONE', OUT, env.shots.length, 'shots');
