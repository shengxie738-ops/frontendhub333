/* Actual production Work motion and React grid tests. jsdom layout and rAF are
 * controlled inputs, not rendered browser, pixel, GPU or live-source evidence.
 * Explicit run: node --test --test-concurrency=1 scripts/work-motion.test.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { afterEach, test } = require('node:test');
const app = path.resolve(__dirname, '..');
const appRequire = createRequire(path.join(app, 'package.json'));
const { JSDOM } = appRequire('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://clone.example/work', pretendToBeVisual: true,
});
for (const name of ['window', 'document', 'HTMLElement', 'MouseEvent', 'Event']) global[name] = dom.window[name];
Object.defineProperty(global, 'navigator', { configurable: true, value: dom.window.navigator });
global.IS_REACT_ACT_ENVIRONMENT = true;
const React = appRequire('react');
const { act } = React;
const { createRoot } = appRequire('react-dom/client');
const ts = appRequire('typescript');
const modules = new Map();
const Link = React.forwardRef(function FixtureLink({ scroll, children, ...props }, ref) {
  return React.createElement('a', { ...props, ref }, children);
});
function load(relative) {
  const file = path.join(app, 'src', relative);
  if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} }; modules.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const localRequire = name => {
    if (name === 'next/link') return { __esModule: true, default: Link };
    if (name.startsWith('.')) {
      const base = path.relative(path.join(app, 'src'), path.resolve(path.dirname(file), name));
      for (const suffix of ['.ts', '.tsx']) if (fs.existsSync(path.join(app, 'src', base + suffix))) return load(base + suffix);
    }
    return appRequire(name);
  };
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })(localRequire, module, module.exports);
  return module.exports;
}
const { Spring, scrollProgress, startTicker } = load('components/work/motion.ts');
const { FeaturedWorkGrid } = load('components/work/FeaturedWorkGrid.tsx');
const production = [
  ['featured/showreel cursor', { stiffness: 1000, damping: 100 }],
  ['archive preview', { stiffness: 1000, damping: 50 }],
  ['featured reveal', { stiffness: 200, damping: 30 }],
];
const close = (actual, expected, epsilon = 1e-9) => assert.ok(Math.abs(actual - expected) < epsilon,
  `expected ${expected} ± ${epsilon}, got ${actual}`);

// Removing the exact stable solver reintroduces exploding low-frame-rate values.
for (const [name, options] of production) {
  for (const dt of [1000 / 120, 1000 / 60, 25, 1000 / 30, 50, 64]) {
    test(`${name}: finite, bounded and settled at ${dt.toFixed(4)}ms`, () => {
      for (const [initial, target] of [[0, 100], [100, -250], [1.4, 1]]) {
        const spring = new Spring(initial, options); spring.set(target);
        const distance = Math.abs(target - initial);
        for (let i = 0; i < Math.ceil(5000 / dt); i++) {
          const value = spring.step(dt);
          assert.ok(Number.isFinite(value));
          assert.ok(Math.abs(value - target) <= distance * 1.1 + 0.001, `unbounded ${name}: ${value}`);
        }
        assert.ok(spring.done, `${name} failed to settle`);
        close(spring.value, target, 0.001);
      }
    });
  }
}

// Physical samples independently evaluated from the ODE with Python double math.
// These are numeric-policy expectations, not sampled original visual timing.
for (const [options, first120, first60, at200] of [
  [{ stiffness: 1000, damping: 100 }, 2.6647525106327468, 8.382798580392596, 87.9751462412995],
  [{ stiffness: 1000, damping: 50 }, 3.0192630654405406, 10.485824194765655, 101.08245678046512],
  [{ stiffness: 200, damping: 30 }, 0.6392895631967406, 2.3567860792561106, 74.76450724155087],
  [{ stiffness: 400, damping: 40 }, 1.2437987627616849, 4.462491923494767, 90.84218055563291],
  [{ stiffness: 1000, damping: 100, mass: 2 }, 1.5138838677771957, 5.300510279143047, 89.84387180760504],
]) {
  test(`exact physical response keeps k/c/m ${JSON.stringify(options)}`, () => {
    for (const [dt, expected] of [[1000 / 120, first120], [1000 / 60, first60]]) {
      const spring = new Spring(0, options); spring.set(100); close(spring.step(dt), expected);
    }
    for (const fps of [30, 60, 120]) {
      const spring = new Spring(0, options); spring.set(100);
      for (let i = 0; i < fps / 5; i++) spring.step(1000 / fps);
      close(spring.value, at200);
    }
  });
}

for (const [name, options] of production) {
  test(`${name}: target reversal preserves state and frame-partition equivalence`, () => {
    function track(dt) {
      const spring = new Spring(0, options);
      for (const target of [200, -150, 80]) {
        const before = spring.value; spring.set(target); assert.equal(spring.value, before);
        for (let remaining = 240; remaining > 1e-9; remaining -= Math.min(dt, remaining)) spring.step(Math.min(dt, remaining));
      }
      return spring;
    }
    const fine = track(1000 / 120);
    for (const dt of [1000 / 60, 1000 / 30, 64]) {
      const spring = track(dt); close(spring.value, fine.value); close(spring.velocity, fine.velocity, 1e-8);
      for (let i = 0; i < 100; i++) spring.step(64);
      assert.ok(spring.done); close(spring.value, 80, 0.001);
    }
  });
  test(`${name}: mixed gaps and bounded background time remain stable`, () => {
    const spring = new Spring(-50, options); spring.set(100);
    for (let i = 0; i < 100; i++) {
      const value = spring.step([1000 / 120, 1000 / 60, 1000 / 30, 64, 5000][i % 5]);
      assert.ok(Number.isFinite(value)); assert.ok(value > -70 && value < 120);
    }
    assert.ok(spring.done); close(spring.value, 100, 0.001);
    const long = new Spring(0, options), capped = new Spring(0, options);
    long.set(100); capped.set(100); close(long.step(3600000), capped.step(64));
    spring.jump(-25); assert.equal(spring.value, -25); assert.ok(spring.done);
    assert.equal(spring.step(64), -25);
  });
}
test('zero/negative step cannot move backwards; done keeps .001 velocity and displacement thresholds', () => {
  const spring = new Spring(0, { stiffness: 200, damping: 30 }); spring.set(1);
  assert.equal(spring.step(0), 0); assert.equal(spring.step(-16), 0);
  spring.jump(10); spring.set(10.0005); assert.ok(spring.done);
  spring.set(10.002); assert.equal(spring.done, false);
  spring.jump(10); spring.velocity = 0.002; assert.equal(spring.done, false);
});

let viewport = 946, scrollY = 0, layoutTop = 1100, layoutHeight = 480, reduced = false, fine = true;
Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => viewport });
Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scrollY });
window.matchMedia = query => ({ matches: query.includes('prefers-reduced-motion') ? reduced : fine });
// Painted rect intentionally changes as production writes scale; layout metrics
// include an offsetParent chain and remain constant through those same writes.
const nativeRect = HTMLElement.prototype.getBoundingClientRect;
const nativeOffsetTop = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetTop');
const nativeOffsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent');
const nativeClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
const hasClass = (el, name) => el.classList.contains(name);
const isFrame = el => hasClass(el, 'FeaturedWorkGrid_item-image__IiTMQ');
const isCropper = el => hasClass(el, 'FeaturedWorkGrid_item-cropper__eCJDn');
const isCard = el => hasClass(el, 'FeaturedWorkGrid_item__hQBLy');
const scaleOf = el => Number(/scale\(([^)]+)\)/.exec(el.style.transform)?.[1] || 1);
Object.defineProperty(HTMLElement.prototype, 'offsetTop', { configurable: true, get() {
  return isFrame(this) ? 12 : isCropper(this) ? 8 : isCard(this) ? layoutTop - 20 : nativeOffsetTop.get.call(this);
} });
Object.defineProperty(HTMLElement.prototype, 'offsetParent', { configurable: true, get() {
  return isFrame(this) || isCropper(this) ? this.parentElement : isCard(this) ? document.documentElement : nativeOffsetParent.get.call(this);
} });
Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get() {
  return isFrame(this) ? layoutHeight : nativeClientHeight.get.call(this);
} });
HTMLElement.prototype.getBoundingClientRect = function () {
  if (!isFrame(this)) return nativeRect.call(this);
  const factor = scaleOf(this) * scaleOf(this.parentElement);
  const height = layoutHeight * factor;
  const top = layoutTop - scrollY + (layoutHeight - height) / 2;
  return { top, height, bottom: top + height, left: 0, right: 640, width: 640, x: 0, y: top };
};
function geometry(top, height) {
  const parent = { offsetTop: 200, offsetParent: null };
  return { offsetTop: top + scrollY - 200, offsetParent: parent, clientHeight: height,
    getBoundingClientRect: () => ({ top, height }) };
}
for (const [vh, height] of [[946, 477.32421875], [900, 600], [768, 400], [1080, 1350]]) {
  test(`historical start-end → end-end boundaries V=${vh}, H=${height}`, () => {
    viewport = vh; scrollY = 123;
    for (const [top, expected] of [[vh + 20, 0], [vh, 0], [vh - height / 2, 0.5], [vh - height, 1], [-height, 1]]) {
      close(scrollProgress(geometry(top, height)), expected);
    }
  });
}
test('zero-height layout target has a finite, safe zero progress', () => {
  viewport = 946; close(scrollProgress(geometry(700, 0)), 0);
});
test('paint transform cannot feed back into production scrollProgress', () => {
  viewport = 946; scrollY = 150;
  const el = geometry(706, 480);
  el.getBoundingClientRect = () => { throw Error('painted geometry must not drive reveal'); };
  close(scrollProgress(el), 0.5);
});

let callbacks = new Map(), nextRaf = 1, now = 100, fixture;
global.requestAnimationFrame = window.requestAnimationFrame = callback => { const id = nextRaf++; callbacks.set(id, callback); return id; };
global.cancelAnimationFrame = window.cancelAnimationFrame = id => callbacks.delete(id);
const listeners = { scroll: new Set(), resize: new Set(), pointermove: new Set() };
const nativeAdd = window.addEventListener.bind(window), nativeRemove = window.removeEventListener.bind(window);
window.addEventListener = (type, listener, options) => { listeners[type]?.add(listener); nativeAdd(type, listener, options); };
window.removeEventListener = (type, listener, options) => { listeners[type]?.delete(listener); nativeRemove(type, listener, options); };
function frame(dt = 1000 / 30) {
  now += dt; const pending = [...callbacks]; callbacks.clear();
  act(() => pending.forEach(([, callback]) => callback(now)));
}
function drain(dt = 1000 / 30, max = 400) {
  let frames = 0;
  while (callbacks.size && frames++ < max) frame(dt);
  assert.equal(callbacks.size, 0, 'ticker must naturally settle within bounded frames');
  return frames;
}
function mount(options = {}) {
  viewport = 946; scrollY = 0; layoutHeight = 480; layoutTop = options.top ?? 1100;
  reduced = options.reduced ?? false; fine = options.fine ?? true;
  document.body.innerHTML = '<div id="root"></div>';
  const root = createRoot(document.getElementById('root'));
  const card = { slug: 'motion-fixture', title: '', client: '', raw: {},
    image: { local: 'fixture.png', alt: 'test', naturalWidth: 1600, naturalHeight: 1100 } };
  act(() => root.render(React.createElement(FeaturedWorkGrid, { cards: [card] })));
  const cropper = document.querySelector('.FeaturedWorkGrid_item-cropper__eCJDn');
  const image = document.querySelector('.FeaturedWorkGrid_item-image__IiTMQ');
  fixture = { root, cropper, image, unmount() { act(() => root.unmount()); fixture = undefined; } };
  return fixture;
}
function wake(type) { act(() => window.dispatchEvent(new Event(type))); }
afterEach(() => {
  fixture?.unmount();
  assert.equal(callbacks.size, 0, 'unmount must cancel every Work rAF');
  for (const type of Object.keys(listeners)) assert.equal(listeners[type].size, 0, `leaked ${type}`);
  viewport = 946; scrollY = 0; callbacks = new Map();
});

test('startTicker stops naturally, can restart and cancelled queued callbacks cannot paint', () => {
  let paints = 0;
  startTicker(() => { paints++; return false; }); frame(); assert.equal(paints, 1); assert.equal(callbacks.size, 0);
  const stop = startTicker(() => { paints++; return true; }); frame(); assert.equal(paints, 2);
  const queued = [...callbacks.values()]; stop(); queued.forEach(cb => cb(now + 64));
  assert.equal(paints, 2); assert.equal(callbacks.size, 0);
});
test('actual grid settles reveal at end-end after scroll, stays stable through scaled repeated ticks and re-wakes', () => {
  const f = mount(); drain(); close(scaleOf(f.cropper), 0.8); close(scaleOf(f.image), 1.4);
  scrollY = layoutTop - (viewport - layoutHeight / 2); wake('scroll'); drain(64);
  close(scaleOf(f.cropper), 0.9, 0.0003); close(scaleOf(f.image), 1.2, 0.0005);
  for (let i = 0; i < 4; i++) { wake('scroll'); drain(64); }
  close(scaleOf(f.cropper), 0.9, 0.0003); close(scaleOf(f.image), 1.2, 0.0005);
  scrollY = layoutTop - (viewport - layoutHeight); wake('scroll'); drain(1000 / 30);
  close(scaleOf(f.cropper), 1, 0.0003); close(scaleOf(f.image), 1, 0.0005); close(Number(f.image.style.opacity), 1);
  scrollY = 0; wake('scroll'); drain(); close(scaleOf(f.cropper), 0.8, 0.0003);
  f.unmount(); const transform = f.image.style.transform; wake('scroll'); wake('resize'); frame(); assert.equal(f.image.style.transform, transform);
});
test('actual grid resize remeasures target layout height and viewport; no cached painted bounds', () => {
  const f = mount(); drain(); scrollY = 500; wake('scroll'); drain();
  const before = scaleOf(f.cropper);
  viewport = 1000; layoutHeight = 600; wake('resize'); drain();
  const p = (viewport - (layoutTop - scrollY)) / layoutHeight;
  close(scaleOf(f.cropper), 0.8 + 0.2 * p, 0.0003); assert.notEqual(scaleOf(f.cropper), before);
});
test('first-screen card at exact layout viewport edge bypasses zoom despite transformed frame top', () => {
  const f = mount({ top: 946 }); drain();
  assert.equal(scaleOf(f.cropper), 1); assert.equal(scaleOf(f.image), 1); assert.equal(f.image.style.opacity, '1');
  scrollY = -100; wake('scroll'); drain(); assert.equal(scaleOf(f.cropper), 1);
});
for (const options of [{ reduced: true }, { fine: false }]) {
  test(`actual grid ${JSON.stringify(options)} is directly stable and visible`, () => {
    const f = mount(options); assert.equal(callbacks.size, 0);
    assert.equal(scaleOf(f.cropper), 1); assert.equal(scaleOf(f.image), 1); assert.equal(f.image.style.opacity, '1');
  });
}
test('just-below-viewport layout card reveals even when painted scale puts its top inside', () => {
  const f = mount({ top: 960 }); drain();
  close(scaleOf(f.cropper), 0.8); close(scaleOf(f.image), 1.4);
  scrollY = layoutTop - (viewport - layoutHeight); wake('scroll'); drain();
  close(scaleOf(f.cropper), 1, 0.0003); close(scaleOf(f.image), 1, 0.0005);
});
test('actual grid low-frame-rate cursor follows retarget and stops; unmount invalidates pending paint', () => {
  const f = mount(); drain();
  function move(x, y) {
    const e = new Event('pointermove'); Object.assign(e, { clientX: x, clientY: y, pointerType: 'mouse' });
    act(() => window.dispatchEvent(e));
  }
  move(500, 300); frame(64); move(-150, 20); drain(1000 / 30);
  const cursor = document.querySelector('.ColoredDotCursor_custom-cursor__QMy_f');
  const xy = /translate3d\(([^p]+)px, ([^p]+)px/.exec(cursor.style.transform);
  close(Number(xy[1]), -150, 0.001); close(Number(xy[2]), 20, 0.001);
  move(900, 200); const pending = [...callbacks.values()]; f.unmount();
  const before = cursor.style.transform; pending.forEach(cb => cb(now + 64));
  assert.equal(cursor.style.transform, before); assert.equal(callbacks.size, 0);
});
