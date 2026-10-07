import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';

const VIEWPORT = { width: Number(process.env.VW || 1440), height: Number(process.env.VH || 900) };
const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const OUT = process.env.OUT_DIR || 'docs/candidates/gladeye';
const LABEL = process.env.LABEL || 'current';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const safeGoto = async (page, url) => {
  try { return await page.goto(url, { waitUntil: 'load', timeout: 120000 }); }
  catch (e) { console.warn('GOTO FAIL', url, String(e.message).slice(0, 90)); return null; }
};

const browser = await chromium.launch({
  channel: 'msedge',
  headless: process.env.HEADED !== '1',
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1, locale: 'en-US' });
const env = { base: BASE, viewport: VIEWPORT, label: LABEL, startedAt: new Date().toISOString(), shots: [], diagnostics: {} };

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${LABEL}__${name}.png` });
  env.shots.push(name);
  console.log('shot:', name);
}

async function diag() {
  return page.evaluate(() => {
    const qa = window.__GLADEYE_QA__;
    const c = document.querySelector('canvas');
    return {
      hasQaBridge: !!qa,
      diagnostics: qa && qa.getDiagnostics ? qa.getDiagnostics() : null,
      canvasPresent: !!c,
      canvasRect: c ? [Math.round(c.getBoundingClientRect().width), Math.round(c.getBoundingClientRect().height)] : null,
      engine: c ? c.getAttribute('data-engine') : null,
      scrollHeight: document.documentElement.scrollHeight,
      innerH: innerHeight,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      consoleErrors: (window.__QA_ERRORS || []),
    };
  });
}
page.on('console', (m) => {
  if (m.type() === 'error') {
    page.evaluate((msg) => { window.__QA_ERRORS = window.__QA_ERRORS || []; window.__QA_ERRORS.push(msg.slice(0, 300)); }, m.text()).catch(() => {});
  }
});

async function settle(ms = 4000) {
  await page.evaluate(async () => { const qa = window.__GLADEYE_QA__; if (qa && qa.waitUntilSettled) { try { await qa.waitUntilSettled(); return; } catch {} } });
  await sleep(ms);
}

// HOME
await safeGoto(page, BASE + '/');
await sleep(9000);
await settle();
env.homeDiag = await diag();
await shot('home__00_intro');
await sleep(6000);
await shot('home__01_stable');

for (const [px, py] of [[0.5, 0.5], [0.12, 0.2], [0.88, 0.2], [0.88, 0.85], [0.12, 0.85]]) {
  await page.evaluate(([x, y]) => { const qa = window.__GLADEYE_QA__; if (qa && qa.setPointer) qa.setPointer(x * 2 - 1, y * 2 - 1); }, [px, py]);
  await page.mouse.move(px * VIEWPORT.width, py * VIEWPORT.height);
  await sleep(1400);
  await shot(`home__pointer-${px}-${py}`);
}

for (const step of [1, 2, 3, 4, 5, 6, 8, 10]) {
  for (let i = 0; i < step; i++) { await page.mouse.wheel(0, 620); await sleep(45); }
  await sleep(2200);
  await settle(1500);
  await shot(`home__scroll-x${step}`);
  env[`scrollDiag_x${step}`] = await diag();
}
await shot('home__full', { fullPage: true });

// MENU
await safeGoto(page, BASE + '/');
await sleep(7000);
const menuBtn = page.locator('button', { hasText: /^Menu$/i }).first();
if (await menuBtn.count()) {
  await menuBtn.click();
  await sleep(1200); await shot('menu__open');
  env.menuItems = (await page.locator('nav a, [class*="Menu"] a, [class*="menu"] a').allTextContents()).filter(Boolean).slice(0, 30);
  const first = page.locator('[class*="Menu"] a, nav a').first();
  if (await first.count()) { await first.hover(); await sleep(700); await shot('menu__hover-item'); }
  await page.keyboard.press('Escape'); await sleep(500); await shot('menu__closing-mid');
  env.menuAfterEsc = await diag();
} else { console.warn('!! Menu button not found'); }

// STATIC PAGES
for (const route of ['/work', '/about', '/contact', '/careers']) {
  const key = route === '/work' ? 'work' : route.slice(1);
  const resp = await safeGoto(page, BASE + route);
  env[`status${route}`] = resp ? resp.status() : 'no-response';
  await sleep(6000);
  await shot(`${key}__0_top`);
  const h = await page.evaluate(() => document.body.scrollHeight);
  for (const m of [0.25, 0.5, 0.75, 1]) {
    await page.evaluate((y) => window.scrollTo(0, y), Math.max(0, Math.round((h - VIEWPORT.height) * m)));
    await sleep(1600);
    await shot(`${key}__${Math.round(m * 100)}pct`);
  }
  await shot(`${key}__full`, { fullPage: true });
  env[`diag${route}`] = await diag();
}

// CASES
const cases = process.env.CASES
  ? process.env.CASES.split(',')
  : ['into-the-amazon', 'cyberbrokers', 'ekos-genesis', 'the-virtual-economy', 'hypercinema'];
for (const slug of cases) {
  const resp = await page.goto(`${BASE}/work/${slug}`, { waitUntil: 'load', timeout: 120000 });
  env[`status_case_${slug}`] = resp ? resp.status() : 'no-response';
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

// ROUTE AUDIT: every case slug must render
const allSlugs = ['into-the-amazon', 'cyberbrokers', 'ekos-genesis', 'the-virtual-economy', 'hypercinema',
  'the-examination', 'the-sweetshop', 'wildsam', 'openavn', 'where-opportunity-takes-root',
  'social-mobility-in-the-digital-age', 'the-dj-and-the-war-crimes', 'eqty-lab-website', 'templar'];
env.routeAudit = [];
for (const slug of allSlugs) {
  const r = await page.goto(`${BASE}/work/${slug}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null);
  const info = await page.evaluate(() => ({ title: document.title.slice(0, 80), h1: (document.querySelector('h1,h2') || {}).textContent?.trim().slice(0, 60) || null, blocks: document.querySelectorAll('img,video,canvas').length })).catch(() => null);
  env.routeAudit.push({ slug, status: r ? r.status() : 'ERR', ...info });
}
writeFileSync(`${OUT}/${LABEL}__run.json`, JSON.stringify(env, null, 1));
await browser.close();
console.log('DONE', OUT, env.shots.length, 'shots; routes:', env.routeAudit.length);
