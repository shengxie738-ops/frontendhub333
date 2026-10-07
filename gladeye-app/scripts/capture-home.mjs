import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { PNG } from 'pngjs';

// Home-only capture: the exact same input sequence and timings as the HOME block
// of capture-local.mjs, so numbers stay comparable with r01, plus a per-shot
// field probe (camera progress, uContainerPos, sprite-size histogram).
//
//   cd gladeye-app && BASE=http://127.0.0.1:3002 LABEL=r02_home node scripts/capture-home.mjs
//
// Env: PROBE=0 disables the probe, SHOTS=01_stable,scroll-x10 restricts output.
//      MODE=sweep SWEEP_STEPS=21 drives `setProgress(p)` across the whole clip
//      instead of the wheel sequence — used to find where the reference frames
//      actually sit on the journey.

const VIEWPORT = { width: Number(process.env.VW || 1440), height: Number(process.env.VH || 900) };
const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const OUT = process.env.OUT_DIR || 'docs/candidates/gladeye';
const LABEL = process.env.LABEL || 'current';
const WANT_PROBE = process.env.PROBE !== '0';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  channel: 'msedge',
  headless: process.env.HEADED !== '1',
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1, locale: 'en-US' });
// SwiftShader renders 960 k sprites at ~2 fps, so screenshots and evaluates can
// legitimately take tens of seconds; the default 30 s cap aborts runs.
page.setDefaultTimeout(240000);
const env = { base: BASE, viewport: VIEWPORT, label: LABEL, startedAt: new Date().toISOString(), shots: [], probes: {} };

page.on('console', (m) => {
  if (m.type() === 'error') {
    page.evaluate((msg) => { window.__QA_ERRORS = window.__QA_ERRORS || []; window.__QA_ERRORS.push(msg.slice(0, 300)); }, m.text()).catch(() => {});
  }
});

// A renderer crash under SwiftShader shows up as a blank page, not as an error.
// Record it so a missing probe can be told apart from an unavailable bridge.
let pageCrashed = null;
page.on('crash', () => {
  pageCrashed = new Date().toISOString();
  console.log('!!! PAGE CRASHED (renderer process gone) !!!');
});

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${LABEL}__${name}.png` });
  env.shots.push(name);
}

async function probe(name) {
  if (!WANT_PROBE) return null;
  const p = await page.evaluate(() => {
    const qa = window.__GLADEYE_QA__;
    if (!qa || !qa.probe) return { unavailable: true };
    const d = qa.getDiagnostics();
    const r = qa.probe(11);
    return { diagnostics: d, probe: r };
  }).catch((e) => ({ error: String(e.message).slice(0, 200) }));
  env.probes[name] = p;
  const f = p && p.probe && p.probe.field;
  const sc = p && p.probe && p.probe.scroller;
  const scLine = sc
    ? ` | acc=${Math.round(sc.accumulator)} ext=${sc.extent} vsEv=${sc.vsEventCount} ` +
      `vsSum=${Math.round(sc.vsDeltaSum)} drift=${Math.round(sc.driftSum)} ` +
      `smoothPct=${sc.smoothedPct === null || sc.smoothedPct === undefined ? 'n/a' : sc.smoothedPct.toFixed(4)} ` +
      `frameMs=${sc.lastFrameMs.toFixed(0)} steps=${sc.stepsRun ?? 'n/a'} debtMs=${(sc.stepDebtMs ?? 0).toFixed(0)}`
    : '';
  const od = f && f.overdraw;
  const odLine = od
    ? ` | grownAll=${od.allGrown} ovrdrawMpx=${(od.allGrownArea / 1e6).toFixed(1)} ` +
      `g500=${od.giant500} g2000=${od.giant2000} maxPx=${od.maxPointSize.toFixed(0)} ` +
      `minDz=${od.minAbsDz.toFixed(3)}`
    : '';
  const line = f
    ? `${name}: pct=${(p.probe.progress ?? 0).toFixed(4)} camZ=${f.cameraWorldZ.toFixed(1)} ` +
      `contZ=${f.containerZ.toFixed(1)} onScreen=${f.onScreen} grown=${f.onScreenGrown} ` +
      `area=${Math.round(f.spriteArea)} maxPx=${f.maxPointSize.toFixed(0)} big=${f.bigPoints} huge=${f.hugePoints}` +
      odLine + scLine
    : `${name}: probe unavailable ${JSON.stringify(p).slice(0, 120)}`;
  console.log(line);
  return p;
}

async function diag() {
  return page.evaluate(() => {
    const qa = window.__GLADEYE_QA__;
    const c = document.querySelector('canvas');
    return {
      hasQaBridge: !!qa,
      diagnostics: qa && qa.getDiagnostics ? qa.getDiagnostics() : null,
      canvasPresent: !!c,
      consoleErrors: window.__QA_ERRORS || [],
    };
  });
}

async function settle(ms = 4000) {
  await page.evaluate(async () => { const qa = window.__GLADEYE_QA__; if (qa && qa.waitUntilSettled) { try { await qa.waitUntilSettled(); return; } catch {} } });
  await sleep(ms);
}

await page.goto(BASE + '/', { waitUntil: 'load', timeout: 120000 });
await sleep(9000);
await settle();

// Optional quality tier, for frame-cost attribution only (high+composer versus
// boost without composer at the same progress). It does not touch the input
// sequence, so default runs stay byte-comparable with r01/r02/r03.
if (process.env.QUALITY) {
  await page.evaluate((q) => window.__GLADEYE_QA__?.setQuality?.(q), process.env.QUALITY);
  await sleep(5000);
  env.qualitySet = process.env.QUALITY;
}

env.homeDiag = await diag();
// A sibling `npm run build` or an in-flight compile can serve a blank/500 page for
// a few minutes; failing fast beats a four-minute run of white screenshots.
if (!env.homeDiag.hasQaBridge || !env.homeDiag.canvasPresent) {
  console.error(
    'ABORT: no QA bridge / canvas at load — dev server did not serve the app page. ' +
      'consoleErrors=' + JSON.stringify(env.homeDiag.consoleErrors || []),
  );
  await browser.close();
  process.exit(3);
}

/** mean luma of a screenshot already on disk (0-255), sampled every 97th px. */
function lumaOf(file) {
  const img = PNG.sync.read(Buffer.from(readFileSync(file)));
  let sum = 0;
  let n = 0;
  for (let i = 0; i < img.data.length; i += 4 * 97) {
    sum += 0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2];
    n += 1;
  }
  return +(sum / n).toFixed(2);
}

if (process.env.MODE === 'sweep') {
  // The reference journey frames are all captured with the pointer parked at
  // (0.12, 0.85) by the pointer loop, so sweep at that same pointer state.
  const ptr = (process.env.SWEEP_POINTER || '0.12,0.85').split(',').map(Number);
  if (ptr.length === 2) {
    await page.evaluate(([x, y]) => {
      const qa = window.__GLADEYE_QA__;
      if (qa && qa.setPointer) qa.setPointer(x * 2 - 1, y * 2 - 1);
    }, ptr);
    await page.mouse.move(ptr[0] * VIEWPORT.width, ptr[1] * VIEWPORT.height);
    await sleep(2500);
  }
  const steps = Number(process.env.SWEEP_STEPS || 21);
  const from = Number(process.env.SWEEP_FROM || 0);
  const to = Number(process.env.SWEEP_TO || 1);
  const rows = [];
  for (let k = 0; k < steps; k++) {
    const pct = from + ((to - from) * k) / (steps - 1);
    await page.evaluate((p) => window.__GLADEYE_QA__.setProgress(p), pct);
    await sleep(Number(process.env.SWEEP_WAIT || 1200));
    const name = `${LABEL}__sweep-${pct.toFixed(3)}.png`;
    // Probe *before* the screenshot: a screenshot of a pathological frame can
    // take the tab down with it, and the numbers are the point of this mode.
    const p = await probe(`sweep-${pct.toFixed(3)}`);
    const f = p && p.probe && p.probe.field;
    await page.screenshot({ path: `${OUT}/${name}` });
    const od = f && f.overdraw;
    rows.push({
      pct: +pct.toFixed(4),
      reportedPct: p && p.probe ? p.probe.progress : null,
      cameraWorldZ: f ? +f.cameraWorldZ.toFixed(2) : null,
      containerZ: f ? +f.containerZ.toFixed(2) : null,
      minAbsDz: od ? +od.minAbsDz.toFixed(4) : null,
      overdrawMpx: od ? +(od.allGrownArea / 1e6).toFixed(1) : null,
      overdrawMaxPx: od ? +od.maxPointSize.toFixed(0) : null,
      giant500: od ? od.giant500 : null,
      giant2000: od ? od.giant2000 : null,
      fps: p && p.diagnostics ? p.diagnostics.fps : null,
      onScreen: f ? f.onScreen : null,
      grown: f ? f.onScreenGrown : null,
      spriteArea: f ? Math.round(f.spriteArea) : null,
      maxPx: f ? Math.round(f.maxPointSize) : null,
      big: f ? f.bigPoints : null,
      huge: f ? f.hugePoints : null,
      luma: lumaOf(`${OUT}/${name}`),
      diag: await diag(),
    });
    const dg = rows[k].diag;
    console.log(
      `   diag canvas=${dg.canvasPresent} mode=${dg.diagnostics && dg.diagnostics.mode} ` +
        `fps=${dg.diagnostics && dg.diagnostics.fps} pts=${dg.diagnostics && dg.diagnostics.pointCount} ` +
        `crash=${pageCrashed || 'none'} ` +
        `errs=${JSON.stringify((dg.consoleErrors || []).slice(0, 2))}`,
    );
    console.log(
      `pct=${pct.toFixed(3)} camZ=${rows[k].cameraWorldZ} grown=${rows[k].grown} ` +
        `minDz=${rows[k].minAbsDz} ovdMpx=${rows[k].overdrawMpx} ` +
        `ovdMaxPx=${rows[k].overdrawMaxPx} area=${rows[k].spriteArea} maxPx=${rows[k].maxPx} LUMA=${rows[k].luma}`,
    );
  }
  env.sweep = rows;
  env.pageCrashed = pageCrashed;
  writeFileSync(`${OUT}/${LABEL}__sweep.json`, JSON.stringify(rows, null, 1));
  await browser.close();
  console.log('SWEEP DONE', rows.length);
  process.exit(0);
}

await shot('home__00_intro');
await probe('home__00_intro');
await sleep(6000);
await shot('home__01_stable');
await probe('home__01_stable');

for (const [px, py] of [[0.5, 0.5], [0.12, 0.2], [0.88, 0.2], [0.88, 0.85], [0.12, 0.85]]) {
  await page.evaluate(([x, y]) => { const qa = window.__GLADEYE_QA__; if (qa && qa.setPointer) qa.setPointer(x * 2 - 1, y * 2 - 1); }, [px, py]);
  await page.mouse.move(px * VIEWPORT.width, py * VIEWPORT.height);
  await sleep(1400);
  await shot(`home__pointer-${px}-${py}`);
  await probe(`home__pointer-${px}-${py}`);
}

for (const step of [1, 2, 3, 4, 5, 6, 8, 10]) {
  for (let i = 0; i < step; i++) { await page.mouse.wheel(0, 620); await sleep(45); }
  await sleep(2200);
  await settle(1500);
  await shot(`home__scroll-x${step}`);
  await probe(`home__scroll-x${step}`);
  env[`scrollDiag_x${step}`] = await diag();
}

env.finalDiag = await diag();
env.pageCrashed = pageCrashed;
writeFileSync(`${OUT}/${LABEL}__run.json`, JSON.stringify(env, null, 1));
await browser.close();
console.log('DONE', OUT, env.shots.length, 'shots');
