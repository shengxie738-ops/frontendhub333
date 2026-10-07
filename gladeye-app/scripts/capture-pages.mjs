import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';

// Fast, page-scoped capture for content routes (no WebGL warm-up wait), so a
// single calibration loop stays under a minute.
const VIEWPORT = { width: Number(process.env.VW || 1440), height: Number(process.env.VH || 900) };
const BASE = process.env.BASE || 'http://127.0.0.1:3002';
const OUT = process.env.OUT_DIR || 'docs/candidates/gladeye';
const LABEL = process.env.LABEL || 'current';
const ROUTES = (process.env.ROUTES || '/work,/about,/contact,/careers').split(',');
const MARKS = (process.env.MARKS || '0,25,50,75,100').split(',').map(Number);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  channel: 'msedge',
  headless: process.env.HEADED !== '1',
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1, locale: 'en-US' });
const report = [];

for (const route of ROUTES) {
  const key = route === '/work' ? 'work' : route.replace(/^\//, '').replace(/\//g, '_');
  let resp = null;
  try {
    resp = await page.goto(BASE + route, { waitUntil: 'load', timeout: 90000 });
  } catch (e) {
    report.push({ route, status: 'NAV-ERR', err: String(e.message).slice(0, 120) });
    continue;
  }
  await sleep(4500);
  const info = await page.evaluate(() => ({
    title: document.title,
    headings: [...document.querySelectorAll('h1,h2,h3')].map((h) => h.tagName + ':' + h.textContent.trim().replace(/\s+/g, ' ').slice(0, 70)).slice(0, 40),
    imgs: document.querySelectorAll('img').length,
    imgsOk: [...document.querySelectorAll('img')].filter((i) => i.complete && i.naturalWidth > 0).length,
    imgsBroken: [...document.querySelectorAll('img')].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.getAttribute('src')).slice(0, 12),
    docH: document.documentElement.scrollHeight,
    overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    theme: document.querySelector('[data-theme]')?.getAttribute('data-theme') || null,
  }));
  const broken = await page.evaluate(() => (window.__PAGE_ERRORS__ || []));
  for (const m of MARKS) {
    await page.evaluate((y) => window.scrollTo(0, y), Math.max(0, Math.round((info.docH - VIEWPORT.height) * (m / 100))));
    await sleep(900);
    await page.screenshot({ path: `${OUT}/${LABEL}__${key}__${m}pct.png` });
  }
  await page.screenshot({ path: `${OUT}/${LABEL}__${key}__full.png`, fullPage: true });
  report.push({ route, status: resp ? resp.status() : '?', ...info, pageErrors: broken });
}

await browser.close();
for (const r of report) {
  console.log(`\n### ${r.route} [${r.status}] theme=${r.theme} docH=${r.docH} imgs=${r.imgs}/${r.imgsOk}ok overflowX=${r.overflowX}`);
  if (r.err) console.log('   nav error:', r.err);
  if (r.imgsBroken?.length) console.log('   BROKEN IMG:', r.imgsBroken.join(' '));
  if (r.headings?.length) console.log('   headings:', r.headings.slice(0, 14).join(' | '));
}
