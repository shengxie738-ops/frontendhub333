import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

// Percentage scroll marks are meaningless when the two pages differ in height:
// 25% of a 7721px clone is not 25% of the original. This harness instead picks
// semantic anchors (section headings, in document order) on the ORIGINAL, then
// screenshots BOTH sites with the same anchor at the same viewport offset.
// Every pair is therefore comparable, and the anchor list is saved as evidence.
const ORIG = 'https://www.gladeye.com';
const LOCAL = process.env.BASE || 'http://127.0.0.1:3005';
const OUT = process.env.OUT_DIR || 'docs/anchors';
const ROUTES = (process.env.ROUTES || '/work,/about,/careers,/contact').split(',');
const MAX_ANCHORS = Number(process.env.MAX_ANCHORS || 6);
const VIEWPORT = { width: 1440, height: 900 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});

/**
 * Headings often contain the same string twice (an animated layer plus its
 * static twin), and the two sites differ in whether a space separates them.
 * Collapse whitespace, drop a duplicated half, and lowercase before matching.
 */
function normKey(text) {
  let t = (text || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const half = Math.floor(t.length / 2);
  if (half > 6) {
    const a = t.slice(0, half).trim();
    const b = t.slice(half).trim();
    if (a === b || a === b.replace(/^\s+/, '') || t === a + a) t = a;
  }
  return t.replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 40);
}

async function anchorsOf(page, url) {
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  await sleep(6000);
  return page.evaluate((max) => {
    const nodes = [...document.querySelectorAll('h1, h2, h3')];
    const seen = new Set();
    const out = [];
    for (const el of nodes) {
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length < 3) continue;
      const top = Math.round(el.getBoundingClientRect().top + window.scrollY);
      const key = text.slice(0, 60);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ text: key, top });
    }
    out.sort((a, b) => a.top - b.top);
    return {
      docH: document.documentElement.scrollHeight,
      anchors: out.filter((a) => a.top >= 0),
    };
  }, MAX_ANCHORS);
}

const report = {};
for (const route of ROUTES) {
  const key = route.replace(/^\//, '').replace(/\//g, '_') || 'root';
  const ctxA = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const pa = await ctxA.newPage();
  let orig;
  try {
    orig = await anchorsOf(pa, ORIG + route);
  } catch (e) {
    console.log('!! original unreachable for', route, String(e.message).slice(0, 80));
    await ctxA.close();
    continue;
  }
  await ctxA.close();

  const ctxB = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const pb = await ctxB.newPage();
  let mine;
  try {
    mine = await anchorsOf(pb, LOCAL + route);
  } catch (e) {
    console.log('!! local unreachable for', route, String(e.message).slice(0, 80));
    await ctxB.close();
    continue;
  }

  console.log(`\n### ${route}  original docH=${orig.docH} mine docH=${mine.docH}`);
  const mineByKey = new Map(mine.anchors.map((a) => [normKey(a.text), a]));
  const matched = [];
  for (const a of orig.anchors) {
    const m = mineByKey.get(normKey(a.text));
    if (!m) { console.log(`  MISSING locally: "${a.text.slice(0, 44)}"`); continue; }
    if (matched.length >= MAX_ANCHORS) break;
    matched.push({ text: a.text.slice(0, 44), origTop: a.top, mineTop: m.top, delta: m.top - a.top });
    console.log(`  ${m.top - a.top === 0 ? 'OK  ' : 'DIFF'} "${a.text.slice(0, 44)}" orig=${a.top} mine=${m.top} delta=${m.top - a.top}`);
  }

  // capture both at the same anchor
  const ctx1 = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const p1 = await ctx1.newPage();
  await p1.goto(ORIG + route, { waitUntil: 'load', timeout: 120000 });
  await sleep(6000);
  const ctx2 = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const p2 = await ctx2.newPage();
  await p2.goto(LOCAL + route, { waitUntil: 'load', timeout: 120000 });
  await sleep(6000);
  for (let i = 0; i < matched.length; i++) {
    await p1.evaluate((y) => window.scrollTo(0, y), Math.max(0, matched[i].origTop - 80));
    await p2.evaluate((y) => window.scrollTo(0, y), Math.max(0, matched[i].mineTop - 80));
    await sleep(1400);
    const slug = `a${String(i).padStart(2, '0')}-${matched[i].text.replace(/[^a-z0-9]+/gi, '-').slice(0, 32).toLowerCase()}`;
    await p1.screenshot({ path: `${OUT}/orig__${key}__${slug}.png` });
    await p2.screenshot({ path: `${OUT}/mine__${key}__${slug}.png` });
  }
  await ctx1.close();
  await ctx2.close();
  await ctxB.close();
  report[route] = { origDocH: orig.docH, mineDocH: mine.docH, anchors: matched };
}

await browser.close();
writeFileSync(`${OUT}/anchor-report.json`, JSON.stringify(report, null, 1));
console.log('\nwrote', `${OUT}/anchor-report.json`);
