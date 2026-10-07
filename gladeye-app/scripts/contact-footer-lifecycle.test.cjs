/* Real React 18 integration tests using app-local jsdom/TypeScript.
 * FooterMount, SiteFooter and marquee modules are actual production code.
 * Next routing/Link and decorative icons are substituted; browser layout,
 * ResizeObserver and RAF are deterministic. This is not browser visual QA.
 */
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
for (const name of ['window', 'document', 'HTMLElement', 'HTMLButtonElement',
  'KeyboardEvent', 'MouseEvent', 'Event']) global[name] = dom.window[name];
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true });
global.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
global.IS_REACT_ACT_ENVIRONMENT = true;
window.scrollTo = () => {};

const React = appRequire('react');
const { act } = React;
const { createRoot } = appRequire('react-dom/client');
const ts = appRequire('typescript');
let pathname = '/work';
const modules = new Map();
const Link = React.forwardRef(function TestLink({ href, scroll, children, onClick, ...props }, ref) {
  return React.createElement('a', { ...props, href, ref, onClick(event) {
    onClick?.(event); event.preventDefault();
  } }, children);
});
const Icon = props => React.createElement('svg', props);
const substitutions = {
  'next/link': { __esModule: true, default: Link },
  'next/navigation': { usePathname: () => pathname },
  '@/components/shared/icons': { LogoWordmark: Icon, ArrowRightUp: Icon, ArrowRight: Icon },
};

function load(relative) {
  const file = path.join(appRoot, 'src', relative);
  if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} };
  modules.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const localRequire = name => {
    if (Object.hasOwn(substitutions, name)) return substitutions[name];
    if (name === '@/lib/theme') return theme;
    if (name.startsWith('@/')) return load(resolveSource(name.slice(2)));
    if (name.startsWith('.')) {
      const source = path.relative(path.join(appRoot, 'src'), path.resolve(path.dirname(file), name));
      return load(resolveSource(source));
    }
    return appRequire(name);
  };
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })(
    localRequire, module, module.exports,
  );
  return module.exports;
}

function resolveSource(relative) {
  for (const suffix of ['', '.tsx', '.ts', '/index.ts']) {
    const candidate = relative + suffix;
    if (fs.existsSync(path.join(appRoot, 'src', candidate)) &&
      fs.statSync(path.join(appRoot, 'src', candidate)).isFile()) return candidate;
  }
  throw new Error(`Cannot resolve production source: ${relative}`);
}

const theme = {
  ...load('lib/theme/themes.ts'), ...load('lib/theme/menu-items.ts'),
  ...load('lib/theme/scroll-lock.ts'), ...load('lib/theme/theme-provider.tsx'),
  ...load('lib/theme/menu-provider.tsx'),
};

// Deterministic browser layout primitives; actual React, FooterMount,
// SiteFooter, GreetingMarquee and useSeamlessMarquee execute unchanged.
const { FooterMount } = load('components/shell/FooterMount.tsx');
const { GreetingMarquee } = load('components/contact/GreetingMarquee.tsx');
const greetings = JSON.parse(fs.readFileSync(path.join(appRoot, 'src/content/contact.json'), 'utf8')).greetings;
const sourceWidths = JSON.parse(fs.readFileSync(path.join(appRoot, 'scripts/contact-fidelity.fixture.json'), 'utf8')).childWidths.map(x => x.width);
let widths = [...sourceWidths], observers = [], root, fonts, resolveFonts;
const listeners = { scroll: new Set(), resize: new Set() };
const nativeAdd = window.addEventListener.bind(window);
const nativeRemove = window.removeEventListener.bind(window);
window.addEventListener = (name, callback, options) => {
  listeners[name]?.add(callback);
  nativeAdd(name, callback, options);
};
window.removeEventListener = (name, callback, options) => {
  listeners[name]?.delete(callback);
  nativeRemove(name, callback, options);
};
let nextFrame = 0;
const frames = new Map();
window.requestAnimationFrame = callback => {
  const id = ++nextFrame;
  frames.set(id, callback);
  return id;
};
window.cancelAnimationFrame = id => frames.delete(id);
Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 3000 });
Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });
Object.defineProperty(window, 'scrollY', { configurable: true, value: 1200 });
class TestResizeObserver {
  constructor(callback) { this.callback = callback; this.targets = new Set(); this.disconnected = false; observers.push(this); }
  observe(target) { this.targets.add(target); }
  disconnect() { this.disconnected = true; this.targets.clear(); }
}
global.ResizeObserver = TestResizeObserver;
window.matchMedia = query => ({ matches: query.includes('1024'), addEventListener() {}, removeEventListener() {} });
function itemWidth(node) {
  if (!node.classList.contains('pr-xl-14')) return 800;
  return widths[[...node.parentElement.children].indexOf(node) % widths.length];
}
Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get() { return Math.round(itemWidth(this)); } });
Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get() { return Math.round(itemWidth(this)); } });
HTMLElement.prototype.getBoundingClientRect = function() { return { width: itemWidth(this), height: 600, x: 0, y: 0, top: 0, left: 0, right: itemWidth(this), bottom: 600 }; };
function reset(route) {
  pathname = route; widths = [...sourceWidths]; observers = []; frames.clear();
  assert.equal(listeners.scroll.size, 0, 'previous footer scroll listener must be cleaned up');
  assert.equal(listeners.resize.size, 0, 'previous footer resize listener must be cleaned up');
  document.body.innerHTML = '<div id="review-root"></div>';
  fonts = new window.EventTarget();
  fonts.ready = new Promise(resolve => { resolveFonts = resolve; });
  Object.defineProperty(document, 'fonts', { configurable: true, value: fonts });
  root = createRoot(document.getElementById('review-root'));
}
function renderFooter(route) { pathname = route; act(() => root.render(React.createElement(FooterMount))); }
afterEach(() => { if (root) { act(() => root.unmount()); root = null; } });


function footerObserver(footer) {
  return observers.find(observer => !observer.disconnected && observer.targets.has(footer));
}

for (const hiddenRoute of ['/contact', '/']) {
  test(`${hiddenRoute} to Work mounts the actual footer with a live height observer`, () => {
    reset(hiddenRoute); renderFooter(hiddenRoute);
    assert.equal(document.querySelector('footer'), null);
    assert.equal(observers.length, 0, 'hidden route must not mount SiteFooter effects');
    renderFooter('/work');
    const footer = document.querySelector('footer');
    assert.ok(footer);
    assert.ok(footerObserver(footer), 'restored footer DOM must have its own height observer');
    assert.equal(observers.filter(observer => !observer.disconnected).length, 1);
  });
}

for (const hiddenRoute of ['/contact', '/']) {
  test(`Work to ${hiddenRoute} to Work cleans the old footer and observes the new DOM`, () => {
    reset('/work'); renderFooter('/work');
    const firstFooter = document.querySelector('footer');
    const firstObserver = footerObserver(firstFooter);
    assert.ok(firstObserver);
    act(() => firstObserver.callback());
    assert.equal(listeners.scroll.size, 1);
    assert.equal(listeners.resize.size, 1);
    renderFooter(hiddenRoute);
    assert.equal(document.querySelector('footer'), null);
    assert.equal(firstObserver.disconnected, true, 'hide must unmount the observer owner');
    assert.equal(firstObserver.targets.size, 0);
    assert.equal(listeners.scroll.size, 0);
    assert.equal(listeners.resize.size, 0);
    renderFooter('/work');
    const secondFooter = document.querySelector('footer');
    assert.notEqual(secondFooter, firstFooter);
    assert.ok(footerObserver(secondFooter), 'new DOM must be measured, not detached old DOM');
    assert.equal(observers.filter(observer => !observer.disconnected).length, 1);
  });
}

test('Contact to Work restores real measured footer parallax and unmount cleans listeners/RAF', () => {
  reset('/contact'); renderFooter('/contact'); renderFooter('/work');
  const footer = document.querySelector('footer');
  const observer = footerObserver(footer);
  assert.ok(observer);
  const inner = footer.querySelector('.ui-grid');
  assert.equal(inner.style.transform, '');
  act(() => observer.callback());
  assert.equal(inner.style.transform, 'translateY(300px)', '600px measured height must drive actual parallax effect');
  assert.equal(listeners.scroll.size, 1);
  assert.equal(listeners.resize.size, 1);
  act(() => window.dispatchEvent(new Event('scroll')));
  assert.equal(frames.size, 1);
  act(() => root.unmount()); root = null;
  assert.equal(observer.disconnected, true);
  assert.equal(observer.targets.size, 0);
  assert.equal(listeners.scroll.size, 0);
  assert.equal(listeners.resize.size, 0);
  assert.equal(frames.size, 0, 'pending parallax RAF must be cancelled');
});

test('visible Work About Careers route changes retain the same real footer and observer', () => {
  reset('/work'); renderFooter('/work');
  const footer = document.querySelector('footer');
  const observer = footerObserver(footer);
  assert.ok(observer);
  renderFooter('/about'); renderFooter('/careers'); renderFooter('/ventures'); renderFooter('/work/walton');
  assert.equal(document.querySelector('footer'), footer);
  assert.equal(footerObserver(footer), observer);
  assert.equal(observers.length, 1);
});

test('real React StrictMode Contact marquee measures and cleans repeated lifecycles', async () => {
  reset('/contact');
  act(() => root.render(React.createElement(React.StrictMode, null, React.createElement(GreetingMarquee, { greetings }))));
  const track = document.querySelector('[data-marquee]');
  assert.equal(track.children.length, 130);
  assert.equal(track.getAttribute('data-running'), 'true');
  assert.equal(track.style.getPropertyValue('--mq-dist'), '42453.84375px');
  assert.equal(track.style.getPropertyValue('--mq-dur'), '425s');
  assert.equal(observers.filter(observer => !observer.disconnected).length, 1);
  assert.equal(observers.at(-1).targets.size, 66);
  widths[0] += 0.125;
  act(() => observers.at(-1).callback());
  assert.equal(track.style.getPropertyValue('--mq-dist'), '42453.96875px');
  widths[0] += 0.25;
  await act(async () => { resolveFonts(); await Promise.resolve(); });
  assert.equal(track.style.getPropertyValue('--mq-dist'), '42454.21875px');
  act(() => root.unmount()); root = null;
  assert.equal(observers.every(observer => observer.disconnected), true);
  const saved = track.style.cssText;
  act(() => {
    window.dispatchEvent(new Event('resize'));
    fonts.dispatchEvent(new Event('loadingdone'));
    for (const observer of observers) observer.callback();
  });
  assert.equal(track.style.cssText, saved, 'no observer/font/resize write after unmount');
});
