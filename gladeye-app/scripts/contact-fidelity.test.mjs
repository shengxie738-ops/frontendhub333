import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const appRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const evidence = JSON.parse(fs.readFileSync(path.join(appRoot, 'scripts/contact-fidelity.fixture.json'), 'utf8'));
const contact = JSON.parse(fs.readFileSync(path.join(appRoot, 'src/content/contact.json'), 'utf8'));

// Transpile the actual production modules with the installed TypeScript. No
// dependency installation, test-only production flags, or source copies.
function loader(overrides = {}, globals = {}) {
  const cache = new Map();
  function load(relative) {
    const file = path.resolve(appRoot, relative);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const source = fs.readFileSync(file, 'utf8');
    const output = ts.transpileModule(source, { compilerOptions: {
      target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    }, fileName: file }).outputText;
    const localRequire = (name) => {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      // next/font/local is a build-time transform; its runtime stub cannot
      // execute under Node. Font construction is outside this route test.
      if (name === 'next/font/local') return () => ({ variable: 'test-font', className: 'test-font', style: { fontFamily: 'test-font' } });
      if (name.startsWith('@/') || name.startsWith('.')) {
        const base = name.startsWith('@/') ? path.join(appRoot, 'src', name.slice(2)) : path.resolve(path.dirname(file), name);
        if (base.endsWith('.json')) return JSON.parse(fs.readFileSync(base, 'utf8'));
        const found = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'].map((ext) => base + ext).find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
        if (found) return load(found);
      }
      return require(name);
    };
    vm.runInNewContext(`(function(require,module,exports){${output}\n})`, { ...globals }, { filename: file })(localRequire, module, module.exports);
    return module.exports;
  }
  return load;
}

function sameDeps(a, b) { return a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index])); }

// Browser layout/events and React's hook scheduling are the unavoidable unit
// boundaries. The hook itself is real. This is not rendered-browser visual QA.
function mountMarquee({ widths = evidence.childWidths.slice(0, 65).map((item) => item.width), period = widths.length, speed = 100, opts = { contactSourceTiming: true } } = {}) {
  const properties = new Map();
  const writes = [];
  const children = [...widths, ...widths].map((width) => ({
    width,
    get offsetWidth() { return Math.round(this.width); },
    get clientWidth() { return Math.round(this.width); },
    getBoundingClientRect() { return { width: this.width }; },
  }));
  const track = { children, style: { setProperty(name, value) { properties.set(name, value); writes.push([name, value]); } } };
  const slots = [];
  const effects = [];
  let cursor = 0;
  let dirty = false;
  let result;
  let resolveFonts;
  const fonts = new EventTarget();
  fonts.ready = new Promise((resolve) => { resolveFonts = resolve; });
  const window = new EventTarget();
  const observers = [];
  class ResizeObserver {
    constructor(callback) { this.callback = callback; this.observed = new Set(); this.disconnected = false; observers.push(this); }
    observe(target) { this.observed.add(target); }
    disconnect() { this.disconnected = true; this.observed.clear(); }
  }
  const hooks = {
    useRef(initial) { const index = cursor++; slots[index] ??= { current: initial === null ? track : initial }; return slots[index]; },
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], (next) => {
        const value = typeof next === 'function' ? next(slots[index]) : next;
        if (!Object.is(value, slots[index])) { slots[index] = value; dirty = true; }
      }];
    },
    useCallback(callback, deps) {
      const index = cursor++;
      if (!sameDeps(slots[index]?.deps, deps)) slots[index] = { callback, deps };
      return slots[index].callback;
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!sameDeps(slots[index]?.deps, deps)) effects.push(() => {
        slots[index]?.cleanup?.();
        slots[index] = { deps, cleanup: effect() };
      });
    },
  };
  const { useSeamlessMarquee } = loader({ react: hooks }, { window, document: { fonts }, ResizeObserver })('src/components/about/useSeamlessMarquee.ts');
  function flush() {
    do {
      dirty = false; cursor = 0;
      result = useSeamlessMarquee(period, speed, opts);
      while (effects.length) effects.shift()();
    } while (dirty);
    return result;
  }
  flush();
  return {
    track, properties, writes, observers, fonts, window, flush,
    get result() { return result; },
    async settleFonts() { resolveFonts(); await Promise.resolve(); await Promise.resolve(); flush(); },
    unmount() { for (const slot of slots) slot?.cleanup?.(); },
  };
}

for (const route of ['/', '/contact', '/work', '/about', '/careers', '/ventures', '/work/walton']) {
  test(`shared footer mount follows source visibility on ${route}`, () => {
    const { FooterMount } = loader({ 'next/navigation': { usePathname: () => route } })('src/components/shell/FooterMount.tsx');
    const markup = renderToStaticMarkup(React.createElement(FooterMount));
    assert.equal(markup.includes('<footer'), route !== '/' && route !== '/contact');
    assert.equal(markup.includes('Subscribe'), route !== '/' && route !== '/contact');
  });
}

test('Contact renders the exact 65-entry cycle twice with commas and accessible duplicate suppression', () => {
  const { GreetingMarquee } = loader({ '@/components/about/useSeamlessMarquee': { useSeamlessMarquee() { return { trackRef: { current: null }, running: false }; } } })('src/components/contact/GreetingMarquee.tsx');
  const tree = GreetingMarquee({ greetings: contact.greetings });
  const track = tree.props.children.props.children;
  const copies = track.props.children;
  assert.equal(copies.length, 2);
  for (const [copyIndex, copy] of copies.entries()) {
    assert.equal(copy.length, 65);
    assert.deepEqual(Array.from(copy, (item) => item.props.children.join('')), evidence.childWidths.slice(0, 65).map((item) => item.text));
    copy.forEach((item, index) => {
      assert.equal(item.props.id, copyIndex === 0 ? `_${index}` : undefined);
      assert.equal(item.props['aria-hidden'], copyIndex === 1 ? 'true' : undefined);
    });
  }
});

test('Contact defaults to the source 100px/s input and opts into unbounded rounded timing', () => {
  let args;
  const { GreetingMarquee } = loader({ '@/components/about/useSeamlessMarquee': { useSeamlessMarquee(...input) { args = input; return { trackRef: { current: null }, running: false }; } } })('src/components/contact/GreetingMarquee.tsx');
  const tree = GreetingMarquee({ greetings: contact.greetings });
  assert.equal(args[1], 100);
  assert.equal(args[2].contactSourceTiming, true);
  assert.equal(tree.props.children.props.children.props['data-rate-verified'], 'true');
});

test('Contact precise distance covers one rendered copy, with source-rounded425s duration beyond the old400s cap', () => {
  const harness = mountMarquee();
  assert.equal(harness.result.distance, 42453.84375);
  assert.equal(harness.properties.get('--mq-dist'), '42453.84375px');
  assert.equal(harness.properties.get('--mq-dur'), '425s');
  assert.equal(harness.result.duration, 425);
  assert.equal(harness.result.running, true);
});

test('source timing uses integer clientWidth while precise travel distance retains fractions', () => {
  const harness = mountMarquee({ widths: Array(20).fill(7.49), speed: 100 });
  assert.equal(harness.result.distance, 149.8);
  assert.equal(harness.result.duration, 1); // round(20*7/100), not round(149.8/100).
});

test('Contact resize observer watches first-cycle children and remeasures fractional widths', () => {
  const harness = mountMarquee({ widths: [100.125, 200.25] });
  assert.equal(harness.observers[0].observed.size, 3);
  harness.track.children[0].width += 0.125;
  harness.observers[0].callback();
  harness.flush();
  assert.equal(harness.result.distance, 300.5);
  assert.equal(harness.properties.get('--mq-dist'), '300.5px');
});

test('font readiness and later font loads both remeasure Contact', async () => {
  const harness = mountMarquee({ widths: [100.125, 200.25] });
  harness.track.children[0].width = 150.375;
  await harness.settleFonts();
  assert.equal(harness.result.distance, 350.625);
  harness.track.children[1].width = 250.5;
  harness.fonts.dispatchEvent(new Event('loadingdone'));
  harness.flush();
  assert.equal(harness.result.distance, 400.875);
});

test('Contact unmount disconnects observers and prevents late fonts or resize writes', async () => {
  const harness = mountMarquee();
  harness.unmount();
  assert.equal(harness.observers[0].disconnected, true);
  const count = harness.writes.length;
  harness.window.dispatchEvent(new Event('resize'));
  harness.fonts.dispatchEvent(new Event('loadingdone'));
  harness.observers[0].callback();
  await harness.settleFonts();
  assert.equal(harness.writes.length, count);
});

test('Careers retains offsetWidth measurement and its60–600s bounded default timing', () => {
  const harness = mountMarquee({ widths: [100.125, 200.25], speed: 60, opts: { minDurationSeconds: 60, maxDurationSeconds: 600 } });
  assert.equal(harness.result.distance, 300);
  assert.equal(harness.properties.get('--mq-dur'), '60s');
  assert.equal(harness.observers[0].observed.size, 1);
});

test('Careers observer cleanup remains safe for the shared hook default', async () => {
  const harness = mountMarquee({ speed: 60, opts: { minDurationSeconds: 60, maxDurationSeconds: 600 } });
  harness.unmount();
  assert.equal(harness.observers[0].disconnected, true);
  const count = harness.writes.length;
  await harness.settleFonts();
  harness.window.dispatchEvent(new Event('resize'));
  assert.equal(harness.writes.length, count);
});

test('source timing supports an explicit speed override without reinstating the400s cap', () => {
  const harness = mountMarquee({ speed: 50 });
  assert.equal(harness.result.duration, 849);
  assert.equal(harness.properties.get('--mq-dur'), '849s');
});

test('Contact with missing or invalid measurement never starts motion', () => {
  for (const widths of [[], [0], [NaN]]) {
    const harness = mountMarquee({ widths });
    assert.equal(harness.result.running, false);
    assert.equal(harness.result.distance, 0);
    assert.equal(harness.properties.size, 0);
  }
});

test('production animation contract is continuous linear left motion with a seamless one-copy reset', () => {
  const css = fs.readFileSync(path.join(appRoot, 'src/styles/info-tokens.css'), 'utf8');
  assert.match(css, /\[data-marquee\]\[data-running='true'\]\s*\{[^}]*animation:\s*mqScroll var\(--mq-dur\) linear infinite both/s);
  assert.match(css, /@keyframes mqScroll\s*\{\s*from\s*\{\s*transform:\s*translate3d\(0, 0, 0\);\s*\}\s*to\s*\{\s*transform:\s*translate3d\(calc\(-1 \* var\(--mq-dist\)\), 0, 0\);/s);
  const { result } = mountMarquee();
  const x = (time) => -result.distance * ((time % result.duration) / result.duration);
  assert.ok(x(1) < x(0));
  assert.ok(Math.abs((x(2) - x(1)) - (x(1) - x(0))) < 1e-9);
  assert.ok(Math.abs(x(result.duration)) === 0);
  assert.ok(Math.abs((x(result.duration - 0.001) + result.distance) - x(0.001) * -1) < 1e-8);
});

test('production reduced-motion CSS freezes the greeting track', () => {
  const css = fs.readFileSync(path.join(appRoot, 'src/styles/info-tokens.css'), 'utf8');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\[data-marquee\]\[data-running='true'\]\s*\{\s*animation:\s*none;\s*transform:\s*none;/s);
});

test('Contact motion metadata distinguishes source-backed input from pending full visual acceptance', () => {
  const { CONTACT_MARQUEE, CAREERS_MARQUEE } = loader()('src/content/pages-schema.ts');
  assert.equal(CONTACT_MARQUEE.speedPxPerSecond, 100);
  assert.equal(CONTACT_MARQUEE.rateVerified, true);
  assert.equal(CAREERS_MARQUEE.speedPxPerSecond, 60);
  assert.equal(CAREERS_MARQUEE.rateVerified, false);
});

test('an explicit Contact speed override is preserved and does not claim source-verified rate metadata', () => {
  let args;
  const { GreetingMarquee } = loader({ '@/components/about/useSeamlessMarquee': { useSeamlessMarquee(...input) { args = input; return { trackRef: { current: null }, running: false }; } } })('src/components/contact/GreetingMarquee.tsx');
  const tree = GreetingMarquee({ greetings: contact.greetings, speedPxPerSecond: 50 });
  assert.equal(args[1], 50);
  assert.equal(tree.props.children.props.children.props['data-rate-verified'], 'false');
  assert.equal(tree.props.children.props.children.props['data-timing-evidence'], 'custom-speed-override');
});
