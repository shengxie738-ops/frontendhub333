/* Real FeaturedWorkGrid / React tests with controlled jsdom media and observer
 * boundaries. No network, browser, server or installed dependency changes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { afterEach, test } = require('node:test');

const appRoot = path.resolve(__dirname, '..');
const appRequire = createRequire(path.join(appRoot, 'package.json'));
const { JSDOM } = appRequire('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://clone.example/work', pretendToBeVisual: true,
});
for (const name of ['window', 'document', 'HTMLElement', 'HTMLMediaElement',
  'HTMLVideoElement', 'MouseEvent', 'Event']) global[name] = dom.window[name];
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true });
global.IS_REACT_ACT_ENVIRONMENT = true;
const React = appRequire('react');
const { act } = React;
const { createRoot } = appRequire('react-dom/client');
const ts = appRequire('typescript');
const modules = new Map();
const Link = React.forwardRef(function TestLink({ scroll, children, ...props }, ref) {
  return React.createElement('a', { ...props, ref }, children);
});
function load(relative) {
  const file = path.join(appRoot, 'src', relative);
  if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} };
  modules.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  function localRequire(name) {
    if (name === 'next/link') return { __esModule: true, default: Link };
    if (name.startsWith('.')) {
      const base = path.relative(path.join(appRoot, 'src'), path.resolve(path.dirname(file), name));
      for (const suffix of ['.tsx', '.ts']) {
        if (fs.existsSync(path.join(appRoot, 'src', base + suffix))) return load(base + suffix);
      }
    }
    return appRequire(name);
  }
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })(localRequire, module, module.exports);
  return module.exports;
}

let reduced = false, hidden = false, cacheReady = 0, observers = [], fixture;
let states = new WeakMap(), nextPlay;
const mediaListeners = new Set(), visibilityListeners = new Set();
const nativeAdd = document.addEventListener.bind(document);
const nativeRemove = document.removeEventListener.bind(document);
document.addEventListener = (type, callback, options) => {
  if (type === 'visibilitychange') visibilityListeners.add(callback);
  nativeAdd(type, callback, options);
};
document.removeEventListener = (type, callback, options) => {
  if (type === 'visibilitychange') visibilityListeners.delete(callback);
  nativeRemove(type, callback, options);
};
Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => hidden ? 'hidden' : 'visible' });
window.matchMedia = query => ({
  media: query, get matches() { return query.includes('prefers-reduced-motion') && reduced; },
  addEventListener(type, listener) { mediaListeners.add(listener); },
  removeEventListener(type, listener) { mediaListeners.delete(listener); },
});
class ControlledObserver {
  constructor(callback, options = {}) { this.callback = callback; this.options = options; this.targets = new Set(); this.disconnected = false; observers.push(this); }
  observe(target) { this.targets.add(target); }
  disconnect() { this.targets.clear(); this.disconnected = true; }
  emit(target, isIntersecting) {
    if (this.targets.has(target)) this.callback([{ target, isIntersecting, intersectionRatio: isIntersecting ? 0.5 : 0 }]);
  }
  sample(target, isIntersecting, intersectionRatio) {
    const thresholds = [this.options.threshold ?? 0].flat();
    const index = thresholds.filter(threshold => threshold <= intersectionRatio).length;
    const previous = this.previous;
    this.previous = { index, isIntersecting };
    if (!previous || previous.index !== index || previous.isIntersecting !== isIntersecting) {
      if (this.targets.has(target)) this.callback([{ target, isIntersecting, intersectionRatio }]);
    }
  }
}
global.IntersectionObserver = window.IntersectionObserver = ControlledObserver;
function state(video) {
  if (!states.has(video)) states.set(video, { ready: cacheReady, paused: true, loadCalls: 0, playCalls: 0, pauseCalls: 0 });
  return states.get(video);
}
Object.defineProperty(HTMLMediaElement.prototype, 'readyState', { configurable: true, get() { return state(this).ready; } });
Object.defineProperty(HTMLMediaElement.prototype, 'paused', { configurable: true, get() { return state(this).paused; } });
HTMLMediaElement.prototype.load = function () { state(this).loadCalls++; };
HTMLMediaElement.prototype.pause = function () { const s = state(this); s.pauseCalls++; s.paused = true; };
HTMLMediaElement.prototype.play = function () {
  const s = state(this); s.playCalls++;
  if (nextPlay) { const fn = nextPlay; nextPlay = undefined; return fn(this); }
  s.paused = false; return Promise.resolve();
};
const { FeaturedWorkGrid } = load('components/work/FeaturedWorkGrid.tsx');
const cards = JSON.parse(fs.readFileSync(path.join(appRoot, 'src/content/projects.json'), 'utf8')).featured;
const known = [2, 3, 4, 5, 6];
function layerElements(card) { return [...card.querySelector('.relative.h-full.w-full').children]; }
function shown(card) { return layerElements(card).findIndex(layer => layer.style.opacity === '1'); }
function mount(indices = [2], options = {}) {
  reduced = options.reduced ?? false; hidden = options.hidden ?? false; cacheReady = options.cacheReady ?? 0;
  observers = []; states = new WeakMap(); nextPlay = undefined;
  document.body.innerHTML = '<div id="root"></div>';
  const root = createRoot(document.getElementById('root'));
  const input = options.cards || indices.map(index => cards[index]);
  const tree = React.createElement(FeaturedWorkGrid, { cards: input });
  act(() => root.render(options.strict ? React.createElement(React.StrictMode, null, tree) : tree));
  fixture = {
    mounted: true, root,
    cards: [...document.querySelectorAll('a.FeaturedWorkGrid_item__hQBLy')],
    video(i = 0) { return this.cards[i].querySelector('video'); },
    media(i = 0) { return this.cards[i].querySelector('.relative.h-full.w-full'); },
    observe(kind, isIntersecting, i = 0) {
      const frame = this.cards[i].querySelector('.FeaturedWorkGrid_item-image__IiTMQ');
      act(() => observers.filter(observer => Boolean(observer.options.rootMargin && observer.options.rootMargin !== '0px') === (kind === 'near'))
        .forEach(observer => observer.emit(frame, isIntersecting)));
    },
    ready(i = 0) { const video = this.video(i); state(video).ready = 4; act(() => video.dispatchEvent(new Event('canplay'))); },
    imageReady(i = 0) { act(() => this.cards[i].querySelectorAll('img:not([aria-hidden])').forEach(image => image.dispatchEvent(new Event('load')))); },
    hover(i = 0) {
      const card = this.cards[i]; const media = this.media(i);
      media.getBoundingClientRect = () => ({ left: 0, width: 600 });
      act(() => {
        card.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body }));
        media.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 500 }));
      });
    },
    leave(i = 0) { act(() => this.cards[i].dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }))); },
    hide(value) { hidden = value; act(() => document.dispatchEvent(new Event('visibilitychange'))); },
    reduce(value) { reduced = value; act(() => [...mediaListeners].forEach(listener => listener({ matches: value }))); },
    unmount() { if (this.mounted) { act(() => root.unmount()); this.mounted = false; } },
  };
  return fixture;
}
async function flush() { await act(async () => { await Promise.resolve(); }); }
function deferredPlay() {
  let resolve, reject, target;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  nextPlay = video => { target = video; return promise; };
  return {
    async resolve() { assert.ok(target, 'activation must call play() before completion'); await act(async () => { state(target).paused = false; resolve(); await promise; }); },
    async reject() { assert.ok(target, 'activation must call play() before rejection'); await act(async () => { reject(new Error('controlled media rejection')); await Promise.resolve(); }); },
  };
}
afterEach(() => { fixture?.unmount(); fixture = undefined; assert.equal(mediaListeners.size, 0); assert.equal(visibilityListeners.size, 0); });

test('five local videos stay mounted without src/download until near or hovered', () => {
  const f = mount(known);
  for (const video of f.cards.map(card => card.querySelector('video'))) {
    assert.equal(video.getAttribute('src'), null);
    assert.equal(video.preload, 'none'); assert.equal(video.autoplay, false);
    assert.equal(video.muted, true); assert.equal(video.loop, true); assert.equal(video.playsInline, true);
    assert.equal(state(video).loadCalls, 0); assert.equal(state(video).playCalls, 0);
  }
  f.observe('near', true, 0);
  assert.ok(f.video().getAttribute('src').startsWith('/sites/gladeye/work/'));
  assert.equal(state(f.video()).loadCalls, 1);
  for (let i = 1; i < 5; i++) assert.equal(f.video(i).getAttribute('src'), null);
});

test('near prepares a hidden secondary without playback and image-first hover becomes reachable', () => {
  const f = mount(); const video = f.video(); f.imageReady(); f.observe('near', true);
  assert.equal(state(video).loadCalls, 1); f.ready();
  assert.equal(shown(f.cards[0]), 0); assert.equal(state(video).playCalls, 0);
  f.observe('visible', true); f.hover();
  assert.equal(shown(f.cards[0]), 1); assert.equal(video.paused, false);
});

test('hover prepares an unready secondary then switches on canplay without another pointer move', () => {
  const f = mount(); f.imageReady(); f.observe('visible', true); f.hover();
  assert.equal(state(f.video()).loadCalls, 1); assert.equal(shown(f.cards[0]), 0);
  f.ready(); assert.equal(shown(f.cards[0]), 1); assert.equal(f.video().paused, false);
});

test('secondary ready before the image uses its actual layer index rather than loaded count', () => {
  const f = mount(); f.observe('visible', true); f.ready(); f.hover();
  assert.equal(shown(f.cards[0]), 1); assert.equal(f.video().paused, false);
});

test('video-first default plays only after readiness and hover/leave selects the same ordered layers', () => {
  const f = mount([3]); const video = f.video(); f.imageReady(); f.observe('near', true); f.observe('visible', true);
  assert.equal(state(video).playCalls, 0); f.ready();
  assert.equal(shown(f.cards[0]), 0); assert.equal(video.paused, false);
  video.currentTime = 3.5; f.hover(); assert.equal(shown(f.cards[0]), 1); assert.equal(video.paused, true);
  f.leave(); assert.equal(shown(f.cards[0]), 0); assert.equal(video.paused, false); assert.equal(video.currentTime, 3.5);
});

test('cached ready media registers without a new canplay event', () => {
  const f = mount([2], { cacheReady: 4 }); f.imageReady(); f.observe('visible', true); f.hover();
  assert.equal(shown(f.cards[0]), 1); assert.equal(f.video().paused, false);
});

test('DJ leave pauses persistent video, restores image and re-hover resumes retained time', () => {
  const f = mount(); const video = f.video(); f.imageReady(); f.observe('visible', true); f.ready(); f.hover();
  video.currentTime = 12.75; f.leave();
  assert.equal(f.video(), video); assert.equal(video.paused, true); assert.equal(shown(f.cards[0]), 0);
  f.hover(); assert.equal(f.video(), video); assert.equal(video.paused, false); assert.equal(video.currentTime, 12.75);
  assert.equal(state(video).loadCalls, 1);
});

test('leaving the viewport pauses and viewport return resumes without resetting progress', () => {
  const f = mount([4]); const video = f.video(); f.observe('visible', true); f.ready(); video.currentTime = 7;
  f.observe('visible', false); assert.equal(video.paused, true); assert.equal(video.currentTime, 7);
  f.observe('near', true); assert.equal(video.paused, true);
  f.observe('visible', true); assert.equal(video.paused, false); assert.equal(video.currentTime, 7);
});

test('hidden page pauses, blocks new preparation and visible return resumes active video', () => {
  const f = mount([3, 6]); const video = f.video(); f.observe('visible', true); f.ready(); video.currentTime = 2;
  f.hide(true); assert.equal(video.paused, true); f.observe('near', true, 1);
  assert.equal(f.video(1).getAttribute('src'), null);
  f.hide(false); assert.equal(video.paused, false); assert.equal(video.currentTime, 2);
});

test('play rejection pauses and keeps the same-card image/link without retry storms', async () => {
  const f = mount([3]); const video = f.video(); const pending = deferredPlay(); f.imageReady(); f.observe('visible', true); f.ready();
  await pending.reject(); await flush();
  assert.equal(video.paused, true); assert.equal(shown(f.cards[0]), 1);
  for (let i = 0; i < 3; i++) { f.observe('visible', false); f.observe('visible', true); f.hover(); f.leave(); }
  assert.equal(state(video).playCalls, 1); assert.equal(f.cards[0].getAttribute('href'), '/work/hypercinema');
});

test('late play completion after leave cannot restart an inactive secondary', async () => {
  const f = mount(); const video = f.video(); f.imageReady(); f.observe('visible', true); f.ready();
  const pending = deferredPlay(); f.hover(); f.leave(); await pending.resolve();
  assert.equal(video.paused, true); assert.equal(shown(f.cards[0]), 0);
});

test('stale play rejection during a new valid activation does not fail the current layer', async () => {
  const f = mount(); const video = f.video(); f.imageReady(); f.observe('visible', true); f.ready();
  const old = deferredPlay(); f.hover(); f.leave(); f.hover(); await old.reject(); await flush();
  assert.equal(video.paused, false); assert.equal(shown(f.cards[0]), 1); assert.equal(state(video).playCalls, 2);
});

test('late old success does not pause a newer permitted activation', async () => {
  const f = mount(); const video = f.video(); f.imageReady(); f.observe('visible', true); f.ready();
  const old = deferredPlay(); f.hover(); f.leave(); f.hover(); await old.resolve();
  assert.equal(video.paused, false); assert.equal(shown(f.cards[0]), 1);
});

test('unmount pauses and clears observers/listeners even if play completes afterward', async () => {
  const f = mount([3]); const video = f.video(); const pending = deferredPlay(); f.observe('visible', true); f.ready();
  f.unmount(); await pending.resolve();
  assert.equal(video.paused, true); assert.ok(observers.every(observer => observer.disconnected));
  assert.equal(mediaListeners.size, 0); assert.equal(visibilityListeners.size, 0);
});

test('local media error falls back to the existing image and never swaps to a remote source', () => {
  const f = mount([6]); const video = f.video(); f.imageReady(); f.observe('visible', true); f.ready();
  const source = video.getAttribute('src'); act(() => video.dispatchEvent(new Event('error')));
  assert.equal(shown(f.cards[0]), 1); assert.equal(video.paused, true); assert.equal(video.getAttribute('src'), source);
  f.hover(); f.leave(); f.observe('visible', true); assert.equal(state(video).loadCalls, 1); assert.equal(state(video).playCalls, 1);
});

test('reduced motion chooses each existing image and prevents all video preparation', () => {
  const f = mount(known, { reduced: true });
  f.cards.forEach((card, i) => {
    f.observe('near', true, i); f.observe('visible', true, i); f.hover(i);
    assert.equal(layerElements(card)[shown(card)].querySelector('video'), null);
    assert.equal(f.video(i).getAttribute('src'), null); assert.equal(state(f.video(i)).playCalls, 0);
  });
});

test('changing reduced-motion pauses current playback and restores the static image', () => {
  const f = mount([3]); const video = f.video(); f.observe('visible', true); f.ready(); video.currentTime = 4;
  f.reduce(true); assert.equal(video.paused, true); assert.equal(shown(f.cards[0]), 1);
  f.reduce(false); assert.equal(shown(f.cards[0]), 0); assert.equal(video.paused, false); assert.equal(video.currentTime, 4);
});

test('near churn and repeated canplay do not repeat downloads or play requests', () => {
  const f = mount([3]); const video = f.video(); f.observe('visible', true); f.ready();
  for (let i = 0; i < 5; i++) { f.observe('near', false); f.observe('near', true); f.ready(); }
  assert.equal(state(video).loadCalls, 1); assert.equal(state(video).playCalls, 1);
});

test('missing detached VIDEO cannot play and cleanup still safely pauses its old node', () => {
  const f = mount([3]); const video = f.video(); f.observe('near', true); video.remove();
  f.observe('visible', true); state(video).ready = 4; act(() => video.dispatchEvent(new Event('canplay')));
  assert.equal(state(video).playCalls, 0); f.unmount(); assert.equal(video.paused, true);
});

test('unmanaged iframe and all-image cards retain the original path with no media observers', () => {
  const imageOnly = structuredClone(cards[2]); imageOnly.slug = 'image-only-fixture'; imageOnly.raw.thumbnails_multimedia = [];
  const f = mount([], { cards: [cards[0], cards[1], imageOnly] });
  assert.equal(observers.length, 0);
  assert.equal(f.cards[0].querySelector('iframe'), null);
  assert.ok(f.cards[1].querySelector('iframe')?.getAttribute('src').includes('/video/1096787331'));
  assert.equal(f.cards[2].querySelector('video,iframe'), null); assert.equal(shown(f.cards[2]), 0);
});

test('hover alone can prepare a secondary but never gives an offscreen card playback permission', () => {
  const f = mount(); const video = f.video(); f.imageReady(); f.hover();
  assert.equal(state(video).loadCalls, 1); f.ready();
  assert.equal(shown(f.cards[0]), 1); assert.equal(state(video).playCalls, 0);
  f.observe('visible', true); assert.equal(video.paused, false);
});

test('initially hidden page does not attach media sources even for a visible hovered card', () => {
  const f = mount([3], { hidden: true }); f.observe('visible', true); f.hover();
  assert.equal(f.video().getAttribute('src'), null); assert.equal(state(f.video()).loadCalls, 0);
  f.hide(false); assert.equal(state(f.video()).loadCalls, 1);
});

test('unmanaged direct files retain legacy src/autoplay behavior and are not enrolled by path shape', () => {
  const legacy = structuredClone(cards[3]); legacy.slug = 'unmanaged-fixture';
  legacy.raw.thumbnail_video = 'https://player.vimeo.com/progressive_redirect/playback/123456789/rendition/1080p/file.mp4';
  const local = structuredClone(legacy); local.slug = 'unmanaged-local-fixture'; local.raw.thumbnail_video = '/sites/gladeye/work/unknown/video/featured-123456789.mp4';
  const f = mount([], { cards: [legacy, local] });
  assert.equal(observers.length, 0);
  assert.equal(f.video().getAttribute('src'), legacy.raw.thumbnail_video); assert.equal(f.video().autoplay, true);
  assert.equal(f.video(1).getAttribute('src'), local.raw.thumbnail_video); assert.equal(f.video(1).autoplay, true);
});

test('a synchronous play exception falls back without sound or repeated attempts', () => {
  const f = mount([3]); const video = f.video(); f.imageReady(); f.observe('visible', true);
  video.muted = false; nextPlay = () => { throw new Error('controlled synchronous failure'); }; f.ready();
  assert.equal(video.muted, true); assert.equal(video.paused, true); assert.equal(shown(f.cards[0]), 1);
  f.observe('visible', false); f.observe('visible', true); assert.equal(state(video).playCalls, 1);
});

test('late rejection after unmount is consumed without mutating a removed card', async () => {
  const f = mount([3]); const video = f.video(); const pending = deferredPlay(); f.observe('visible', true); f.ready();
  f.unmount(); await pending.reject(); await flush(); assert.equal(video.paused, true);
});

test('StrictMode effect replay does not duplicate preparation, observer ownership or playback', () => {
  const f = mount([3], { strict: true }); const video = f.video(); f.observe('visible', true); f.ready();
  assert.equal(state(video).loadCalls, 1); assert.equal(state(video).playCalls, 1);
  assert.equal(observers.filter(observer => !observer.disconnected).length, 2);
  assert.equal(mediaListeners.size, 1); assert.equal(visibilityListeners.size, 1);
});

test('without IntersectionObserver geometry still bounds preparation/playback and cleans scroll listeners', () => {
  const originalGeometry = HTMLElement.prototype.getBoundingClientRect;
  let top = 2000;
  HTMLElement.prototype.getBoundingClientRect = () => ({ top, bottom: top + 400, left: 0, right: 600, height: 400, width: 600 });
  global.IntersectionObserver = window.IntersectionObserver = undefined;
  try {
    const f = mount([3]); const video = f.video(); assert.equal(video.getAttribute('src'), null);
    top = 950; act(() => window.dispatchEvent(new Event('scroll')));
    assert.equal(state(video).loadCalls, 1); f.ready(); assert.equal(state(video).playCalls, 0);
    top = 100; act(() => window.dispatchEvent(new Event('resize'))); assert.equal(video.paused, false);
    top = -500; act(() => window.dispatchEvent(new Event('scroll'))); assert.equal(video.paused, true);
    f.unmount(); top = 100; act(() => window.dispatchEvent(new Event('scroll'))); assert.equal(state(video).playCalls, 1);
  } finally {
    HTMLElement.prototype.getBoundingClientRect = originalGeometry;
    global.IntersectionObserver = window.IntersectionObserver = ControlledObserver;
  }
});

test('edge-adjacent IO sample cannot leave ready active media paused throughout its visible pass', () => {
  const f = mount([3]); const video = f.video(); f.observe('near', true); f.ready();
  const frame = f.cards[0].querySelector('.FeaturedWorkGrid_item-image__IiTMQ');
  const observer = observers.find(entry => entry.options.rootMargin === '0px');
  act(() => observer.sample(frame, false, 0));
  act(() => observer.sample(frame, true, 0)); assert.equal(video.paused, true);
  act(() => observer.sample(frame, true, 0.5)); assert.equal(video.paused, false);
});

test('a batched old-visible/latest-offscreen observation pauses according to the newest card record', () => {
  const f = mount([3]); const video = f.video(); f.observe('visible', true); f.ready(); assert.equal(video.paused, false);
  const frame = f.cards[0].querySelector('.FeaturedWorkGrid_item-image__IiTMQ');
  const observer = observers.find(entry => entry.options.rootMargin === '0px');
  act(() => observer.callback([
    { target: frame, isIntersecting: true, intersectionRatio: 0.5, time: 1 },
    { target: frame, isIntersecting: false, intersectionRatio: 0, time: 2 },
  ]));
  assert.equal(video.paused, true);
});

test('existing classes and layer transition values are unchanged', () => {
  const f = mount(); const layers = layerElements(f.cards[0]);
  assert.equal(f.cards[0].getAttribute('href'), '/work/the-dj-and-the-war-crimes');
  assert.ok(f.cards[0].querySelector('.FeaturedWorkGrid_item-cropper__eCJDn'));
  for (const layer of layers) {
    assert.equal(layer.className, 'absolute bottom-0 left-0 right-0 top-0 z-10');
    assert.equal(layer.style.transitionDuration, '125ms');
    assert.equal(layer.style.transitionTimingFunction, 'cubic-bezier(0.165, 0.84, 0.44, 1)');
  }
});
