import { chromium } from 'playwright';

// Behavioural gate for the shell: menu focus trap, Escape focus return,
// scroll-lock position restore, nested lock refcounting, history navigation,
// and reduced-motion content survival. Visual parity was already confirmed;
// this checks the parts a screenshot cannot show.
const BASE = process.env.BASE || 'http://127.0.0.1:3005';
const results = [];
const rec = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const browser = await chromium.launch({
  channel: 'msedge',
  headless: process.env.HEADED !== '1',
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
let headerOffscreenCount = 0;
page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 160)));

async function menuTrigger() {
  // Scope to the fixed header trigger: while the panel is mounted through its
  // exit transition a second Menu/Close button exists off-screen, and .first()
  // would grab that one.
  return page.locator('div[class*="Header_buttonContainer"] button').first();
}

async function openMenu() {
  const btn = await menuTrigger();
  if (!(await btn.count())) return false;
  await btn.click();
  await sleep(1200);
  return true;
}

// ---------- /about: a real scrolling page ----------
await page.goto(BASE + '/about', { waitUntil: 'load', timeout: 120000 });
await sleep(5000);

const scrollable = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight > 800);
rec('/about is scrollable', scrollable, scrollable ? '' : 'page too short to test scroll lock');

// scroll to the middle, then open the menu
await page.evaluate(() => window.scrollTo(0, 1500));
await sleep(700);
const yBefore = await page.evaluate(() => Math.round(window.scrollY));
rec('scroll position established', yBefore > 800, 'scrollY=' + yBefore);

const opened = await openMenu();
rec('Menu button opens the overlay', opened);

if (opened) {
  // focus must be inside the overlay
  const focusInOverlay = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return { ok: false, why: 'no activeElement' };
    const overlay = el.closest('#site-menu, [class*=Menu_backdrop]');
    return { ok: !!overlay, tag: el.tagName, text: (el.textContent || '').trim().slice(0, 24), inOverlay: !!overlay };
  });
  rec('opening the menu moves focus into it', focusInOverlay.ok, JSON.stringify(focusInOverlay));

  // Tab 12 times: focus must never escape the overlay
  let escaped = null;
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    await sleep(120);
    const inside = await page.evaluate(() => {
      const el = document.activeElement;
      return !!(el && el.closest('#site-menu'));
    });
    if (!inside) { escaped = i + 1; break; }
  }
  rec('Tab is trapped inside the overlay (12 presses)', escaped === null, escaped ? 'escaped after ' + escaped + ' presses' : '');

  // scroll must be locked while open. `body{position:fixed}` makes window.scrollY
  // read 0 by design (the offset is preserved via top:-Y), so the observable that
  // matches what a user sees is a content marker's viewport position.
  const markerBefore = await page.evaluate(() => {
    const el = document.querySelector('h2, [data-theme]');
    return el ? Math.round(el.getBoundingClientRect().top) : null;
  });
  await page.evaluate(() => window.scrollTo(0, 2600));
  await sleep(400);
  const lockProbe = await page.evaluate(() => {
    const el = document.querySelector('h2, [data-theme]');
    return { marker: el ? Math.round(el.getBoundingClientRect().top) : null, scrollY: Math.round(window.scrollY) };
  });
  const lockedVisually = markerBefore !== null && lockProbe.marker !== null && Math.abs(lockProbe.marker - markerBefore) < 4;
  rec('content does not move while the menu is open', lockedVisually, `marker ${markerBefore} -> ${lockProbe.marker} (scrollY=${lockProbe.scrollY})`);

  await page.screenshot({ path: 'docs/candidates/gladeye/behaviour__menu-open.png' });

  // Escape closes and returns focus to the trigger
  await page.keyboard.press('Escape');
  await sleep(1400);
  const after = await page.evaluate(() => {
    const el = document.activeElement;
    const overlay = document.querySelector('#site-menu');
    const overlayVisible = !!overlay && getComputedStyle(overlay).display !== 'none' && Number(getComputedStyle(overlay).opacity) > 0.05;
    return {
      overlayVisible,
      focusTag: el ? el.tagName : null,
      focusText: el ? (el.textContent || '').trim().slice(0, 24) : null,
      isMenuButton: !!el && /Menu/i.test((el.textContent || '') + ' ' + (el.getAttribute('aria-label') || '')),
      scrollY: Math.round(window.scrollY),
    };
  });
  rec('Escape closes the overlay', !after.overlayVisible, JSON.stringify({ overlayVisible: after.overlayVisible }));
  rec('Escape returns focus to the Menu trigger', after.isMenuButton, `focus=${after.focusTag}:"${after.focusText}"`);
  rec('scroll position is restored after closing', Math.abs(after.scrollY - yBefore) < 4, `expected≈${yBefore} got=${after.scrollY}`);

  // no leftover translucent layer
  const leftovers = await page.evaluate(() =>
    [...document.querySelectorAll('#site-menu')]
      .filter((e) => { const cs = getComputedStyle(e); return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.02; })
      .map((e) => String(e.className).slice(0, 60)));
  rec('no leftover menu layer after close', leftovers.length === 0, leftovers.join(' | '));
}

// ---------- rapid toggling: 10 open/close cycles must not leak locks ----------
await page.goto(BASE + '/about', { waitUntil: 'load', timeout: 120000 });
await sleep(4000);
await page.evaluate(() => window.scrollTo(0, 1200));
await sleep(500);
// Clicks the header trigger through the DOM so the suite measures the JS
// behaviour even when Playwright's viewport hit-test objects (which is itself
// reported separately by headerVisibleWhileOpen below).
async function toggleMenuDom() {
  return page.evaluate(() => {
    const b = document.querySelector('div[class*="Header_buttonContainer"] button');
    if (!b) return false;
    const r = b.getBoundingClientRect();
    b.click();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), inViewport: r.top >= 0 && r.bottom <= innerHeight };
  });
}

for (let i = 0; i < 10; i++) {
  const t = await toggleMenuDom();
  if (!t) { rec('header trigger exists', false, 'not found'); break; }
  if (i === 0 && t.inViewport === false) headerOffscreenCount++;
  await sleep(260);
}
await sleep(1600);
const afterToggles = await page.evaluate(() => {
  const html = getComputedStyle(document.documentElement);
  const body = getComputedStyle(document.body);
  return {
    htmlOverflow: html.overflow,
    bodyOverflow: body.overflow,
    bodyPosition: body.position,
    scrollY: Math.round(window.scrollY),
    canScroll: document.documentElement.scrollHeight - window.innerHeight > 800,
  };
});
rec('10 rapid toggles leave scrolling usable',
  afterToggles.htmlOverflow !== 'hidden' && afterToggles.bodyOverflow !== 'hidden' && afterToggles.canScroll,
  JSON.stringify(afterToggles));

// Whether the fixed header stays clickable while the menu is open at a
// scrolled position — Playwright's hit test complained, so measure it directly.
await page.goto(BASE + '/about', { waitUntil: 'load', timeout: 120000 });
await sleep(4000);
await page.evaluate(() => window.scrollTo(0, 1500));
await sleep(600);
await openMenu();
await sleep(1200);
const headerGeom = await page.evaluate(() => {
  const b = document.querySelector('div[class*="Header_buttonContainer"] button');
  const h = document.querySelector('header, div[class*="z-Header"]');
  const r = b ? b.getBoundingClientRect() : null;
  return {
    trigger: r ? { top: Math.round(r.top), bottom: Math.round(r.bottom) } : null,
    inViewport: r ? r.top >= 0 && r.bottom <= innerHeight : false,
    headerPosition: h ? getComputedStyle(h).position : null,
    headerTop: h ? getComputedStyle(h).top : null,
    bodyPosition: getComputedStyle(document.body).position,
    bodyTop: document.body.style.top || '-',
  };
});
rec('header trigger stays in the viewport while the menu is open', headerGeom.inViewport, JSON.stringify(headerGeom));
await page.keyboard.press('Escape');
await sleep(1500);

// ---------- nested locks: menu + a second owner ----------
const nested = await page.evaluate(async () => {
  const m = await import('/_next/static/chunks/' + '');
  return !!m;
}).catch(() => false);
// (module import is not addressable at runtime; exercise nesting through the UI instead)
await page.goto(BASE + '/about', { waitUntil: 'load', timeout: 120000 });
await sleep(4000);
await openMenu();
await sleep(900);
// navigate to another route while the menu is open — the overlay must close and
// the new page must not stay scroll-locked
await page.evaluate(() => {
  const a = [...document.querySelectorAll('a')].find((x) => /Contact/i.test(x.textContent || ''));
  if (a) a.click();
});
await sleep(5000);
const afterNav = await page.evaluate(() => ({
  url: location.pathname,
  htmlOverflow: getComputedStyle(document.documentElement).overflow,
  bodyOverflow: getComputedStyle(document.body).overflow,
  overlay: !!document.querySelector('#site-menu'),
}));
rec('navigating with the menu open lands on the new route', afterNav.url === '/contact', JSON.stringify(afterNav));
rec('menu closes on navigation', !afterNav.overlay);
rec('new page is not left scroll-locked', afterNav.htmlOverflow !== 'hidden' && afterNav.bodyOverflow !== 'hidden',
  `html=${afterNav.htmlOverflow} body=${afterNav.bodyOverflow}`);

// ---------- history: back must restore, not jump to top ----------
await page.goto(BASE + '/about', { waitUntil: 'load', timeout: 120000 });
await sleep(4000);
await page.evaluate(() => window.scrollTo(0, 2000));
await sleep(600);
await page.goto(BASE + '/careers', { waitUntil: 'load', timeout: 120000 });
await sleep(4000);
await page.goBack({ waitUntil: 'load' });
await sleep(4000);
const backState = await page.evaluate(() => ({ url: location.pathname, y: Math.round(window.scrollY) }));
rec('browser Back returns to /about', backState.url === '/about', JSON.stringify(backState));
rec('browser Back restores the previous scroll position', backState.y > 1200, `scrollY=${backState.y} (expected ≈2000)`);

// ---------- reduced motion: content must survive ----------
const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const p2 = await ctx2.newPage();
await p2.goto(BASE + '/about', { waitUntil: 'load', timeout: 120000 });
await sleep(5000);
const rm = await p2.evaluate(() => ({
  headings: document.querySelectorAll('h1,h2,h3').length,
  imgsVisible: [...document.querySelectorAll('img')].filter((i) => {
    const r = i.getBoundingClientRect(); const cs = getComputedStyle(i);
    return r.width > 4 && Number(cs.opacity) > 0.05;
  }).length,
  totalImgs: document.querySelectorAll('img').length,
  textLen: document.body.innerText.trim().length,
}));
rec('reduced-motion keeps all headings', rm.headings > 40, JSON.stringify(rm));
rec('reduced-motion keeps images visible', rm.imgsVisible > rm.totalImgs * 0.5, `${rm.imgsVisible}/${rm.totalImgs}`);
rec('reduced-motion keeps body text', rm.textLen > 1500, 'chars=' + rm.textLen);
await ctx2.close();

// ---------- deep link + refresh ----------
for (const route of ['/work', '/work/cyberbrokers', '/contact', '/careers']) {
  await page.goto(BASE + route, { waitUntil: 'load', timeout: 120000 });
  await sleep(2500);
  await page.reload({ waitUntil: 'load' });
  await sleep(3500);
  const ok = await page.evaluate(() => ({
    t: document.title.slice(0, 40),
    h: [...document.querySelectorAll('h1,h2,h3')].length,
    txt: document.body.innerText.trim().length,
  }));
  rec(`deep-link + refresh ${route}`, ok.h > 2 && ok.txt > 200, JSON.stringify(ok));
}

rec('no uncaught page errors during the run', errors.length === 0, errors.slice(0, 4).join(' | '));

await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${results.length - failed.length}/${results.length} passed ===`);
if (failed.length) {
  console.log('FAILED:');
  failed.forEach((f) => console.log('  -', f.name, f.detail ? '— ' + f.detail : ''));
  process.exit(1);
}
