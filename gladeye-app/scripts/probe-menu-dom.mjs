import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://127.0.0.1:3005';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await page.goto(BASE + '/about', { waitUntil: 'load', timeout: 120000 });
await sleep(6000);

const probe = async (label) => {
  const d = await page.evaluate(() => {
    const ae = document.activeElement;
    const fixed = [...document.querySelectorAll('*')].filter((e) => {
      const cs = getComputedStyle(e);
      return cs.position === 'fixed' && e.getBoundingClientRect().height > window.innerHeight * 0.6;
    }).map((e) => String(e.className).slice(0, 80));
    return {
      scrollY: Math.round(window.scrollY),
      docH: document.documentElement.scrollHeight,
      winH: window.innerHeight,
      htmlOverflow: getComputedStyle(document.documentElement).overflow,
      htmlInlineOverflow: document.documentElement.style.overflow || '-',
      bodyPosition: getComputedStyle(document.body).position,
      bodyInlinePosition: document.body.style.position || '-',
      bodyTop: document.body.style.top || '-',
      active: ae ? ae.tagName + '.' + String(ae.className).slice(0, 40) + ' "' + (ae.textContent || '').trim().slice(0, 18) + '"' : null,
      activeIsMenuTrigger: !!ae && /Header_button/.test(String(ae.className)),
      bigFixedEls: fixed.slice(0, 6),
      dialogRoles: document.querySelectorAll('[role=dialog]').length,
      scrollLockMarked: [...document.querySelectorAll('[data-scroll-lock-owner]')].map((e) => e.getAttribute('data-scroll-lock-owner')),
    };
  });
  console.log('\n###', label);
  console.log(JSON.stringify(d, null, 1));
  return d;
};

await page.evaluate(() => window.scrollTo(0, 1500));
await sleep(800);
await probe('after scrollTo(1500), menu closed');

await page.locator('button', { hasText: /^Menu$/i }).first().click();
await sleep(1500);
await probe('menu OPEN');

await page.keyboard.press('Tab');
await sleep(300);
await probe('after 1 Tab with menu open');

await page.keyboard.press('Escape');
await sleep(2000);
await probe('after Escape');

console.log('\n=== rapid toggling x10 ===');
await page.evaluate(() => window.scrollTo(0, 1200));
await sleep(500);
for (let i = 0; i < 10; i++) {
  await page.locator('button', { hasText: /^(Menu|Close)$/i }).first().click();
  await sleep(240);
}
await sleep(2500);
const after = await probe('after 10 rapid toggles');
const canScroll = await page.evaluate(async () => {
  window.scrollTo(0, 2500);
  await new Promise((r) => setTimeout(r, 500));
  return Math.round(window.scrollY);
});
console.log('\nscroll attempt after toggles -> scrollY =', canScroll);
await browser.close();
