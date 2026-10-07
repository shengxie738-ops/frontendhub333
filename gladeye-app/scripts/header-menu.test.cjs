/* Safe real React 18 component tests: no browser launch. jsdom and TypeScript
 * are pinned/declared in this app. Providers, route sync, shell and scroll lock
 * are real; Next routing and unrelated visual children are substituted. */
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
  '@/components/shared/icons': { LogoWordmark: Icon, ArrowRightUp: Icon },
  '@/components/shell/RandomFlower': { RandomFlowerSlot: () => React.createElement('svg') },
  '@/components/shell/SiteFooter': { FooterContact: () => React.createElement('footer') },
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
const { SiteHeader } = load('components/shell/SiteHeader.tsx');
const { MenuOverlay } = load('components/shell/MenuOverlay.tsx');
const { Button } = load('components/shell/Button.tsx');
const { RouteThemeSync } = load('components/shell/RouteThemeSync.tsx');

function fakeClock() {
  let now = 0, sequence = 0;
  const tasks = new Map();
  const originals = Object.fromEntries(['setTimeout', 'clearTimeout', 'requestAnimationFrame',
    'cancelAnimationFrame'].map(key => [key, window[key]]));
  window.setTimeout = (callback, delay = 0) => {
    const id = ++sequence; tasks.set(id, { callback, at: now + delay }); return id;
  };
  window.clearTimeout = id => tasks.delete(id);
  window.requestAnimationFrame = callback => window.setTimeout(() => callback(now), 16);
  window.cancelAnimationFrame = window.clearTimeout;
  return {
    pending: () => tasks.size,
    advance(ms) {
      const until = now + ms;
      while (true) {
        const next = [...tasks.entries()].filter(([, task]) => task.at <= until)
          .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!next) break;
        tasks.delete(next[0]); now = next[1].at; act(() => next[1].callback());
      }
      now = until;
    },
    restore() { Object.assign(window, originals); tasks.clear(); },
  };
}

let fixture;
function mount({ mode = 'header', syncRoute = true, strict = false, buttonProps = {} } = {}) {
  pathname = '/work';
  document.body.innerHTML = '<button id="outside">Outside</button><div id="root"></div>';
  document.documentElement.style.cssText = '';
  document.body.style.cssText = '';
  const clock = fakeClock();
  const root = createRoot(document.getElementById('root'));
  let current;
  function Controller() {
    current = { ...theme.useMenu(), ...theme.useTheme() };
    return React.createElement(React.Fragment, null,
      syncRoute ? React.createElement(RouteThemeSync) : null,
      mode === 'header' ? React.createElement(SiteHeader) :
        mode === 'overlay' ? React.createElement(MenuOverlay) :
          React.createElement(Button, buttonProps, 'Example'),
    );
  }
  function tree() {
    const providers = React.createElement(theme.ThemeProvider, {
      initialPageTheme: 'light', initialHeaderTheme: 'light',
    }, React.createElement(theme.MenuProvider, null, React.createElement(Controller)));
    return strict ? React.createElement(React.StrictMode, null, providers) : providers;
  }
  act(() => root.render(tree()));
  fixture = {
    clock, current: () => current,
    click(element) { act(() => element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))); },
    open() { act(() => current.openMenu()); }, close() { act(() => current.closeMenu()); },
    headerTheme(value) { act(() => current.setHeaderTheme(value)); },
    pageTheme(value) { act(() => current.setPageTheme(value)); },
    navigate(route) { pathname = route; act(() => root.render(tree())); },
    key(key, options = {}) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
      act(() => document.activeElement.dispatchEvent(event)); return event;
    },
    unmount() { if (fixture.mounted) { act(() => root.unmount()); fixture.mounted = false; } },
    mounted: true,
  };
  return fixture;
}
afterEach(() => {
  if (fixture) { fixture.unmount(); theme.forceReleaseAllScrollLocks(); fixture.clock.restore(); fixture = null; }
});
const menuButton = () => document.querySelector('button[aria-label="Open menu"],button[aria-label="Close menu"]');

test('header forwards collapsed/expanded state and controls to the actual button', () => {
  const f = mount(); const button = menuButton();
  assert.equal(button.getAttribute('aria-expanded'), 'false');
  assert.equal(button.getAttribute('aria-controls'), 'site-menu');
  f.click(button);
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  assert.equal(document.getElementById('site-menu').getAttribute('data-menu-open'), 'true');
});

test('header registers the actual button as its focus-return trigger and clears it on detach', () => {
  const f = mount(); const button = menuButton(); const reference = f.current().triggerRef;
  assert.ok(reference.current === button, 'registered trigger must be the actual Menu button');
  f.unmount(); assert.equal(reference.current, null);
});

test('internal Button link forwards its element ref', () => {
  let element; const f = mount({ mode: 'button', buttonProps: { link: '/work', elementRef: value => { element = value; } } });
  assert.ok(element === document.querySelector('#root a'), 'element ref must point at the internal anchor');
  f.unmount(); assert.equal(element, null);
});

test('external Button link forwards its accessibility attributes', () => {
  mount({ mode: 'button', buttonProps: { link: 'https://example.com', ariaLabel: 'Example link',
    ariaExpanded: true, ariaControls: 'example-panel' } });
  const anchor = document.querySelector('#root a');
  assert.equal(anchor.getAttribute('aria-label'), 'Example link');
  assert.equal(anchor.getAttribute('aria-expanded'), 'true');
  assert.equal(anchor.getAttribute('aria-controls'), 'example-panel');
});

test('opening preserves header focus and does not trap native Close-to-About tab order', () => {
  const f = mount(); const button = menuButton(); button.focus(); f.click(button); f.clock.advance(20);
  assert.ok(document.activeElement === button, 'opening must leave focus on the header button');
  assert.equal(f.key('Tab').defaultPrevented, false);
  const about = document.querySelector('a[aria-label="About"]'); about.focus();
  assert.equal(f.key('Tab').defaultPrevented, false);
});

test('Escape returns focus to the registered trigger even when opened from outside it', () => {
  const f = mount(); document.getElementById('outside').focus(); f.open();
  document.querySelector('#site-menu a[href="/work"]').focus(); f.key('Escape');
  assert.equal(f.current().open, false);
  assert.ok(document.activeElement === menuButton(), 'Escape must return focus to the Menu button');
});

test('closing keeps the visual exit mounted but immediately makes its navigation inert', () => {
  const f = mount(); f.open(); f.close();
  const nav = document.getElementById('site-menu');
  assert.ok(nav); assert.equal(nav.getAttribute('aria-hidden'), 'true'); assert.ok(nav.hasAttribute('inert'));
  f.clock.advance(449); assert.ok(document.getElementById('site-menu'));
  f.clock.advance(1); assert.equal(document.getElementById('site-menu'), null);
});

test('reopening cancels the old exit and theme restore timers', () => {
  const f = mount(); f.open(); f.close(); f.clock.advance(200); f.open(); f.clock.advance(20);
  assert.equal(f.clock.pending(), 0);
  f.clock.advance(430); assert.equal(f.current().headerTheme, 'green');
  assert.equal(document.getElementById('site-menu').getAttribute('data-menu-open'), 'true');
});

test('close-reopen-close restores the original theme instead of saving menu green', () => {
  const f = mount(); f.open(); f.close(); f.clock.advance(200); f.open(); f.clock.advance(500);
  f.close(); f.clock.advance(450); assert.equal(f.current().headerTheme, 'light');
});

test('a new header theme during exit is not overwritten by an obsolete restore', () => {
  const f = mount(); f.open(); f.close(); f.headerTheme('yellow'); f.clock.advance(450);
  assert.equal(f.current().headerTheme, 'yellow');
});

test('a section theme update while open preserves green and becomes the close-restore theme', () => {
  const f = mount(); f.open(); f.headerTheme('yellow');
  assert.equal(f.current().headerTheme, 'green');
  f.close(); f.clock.advance(450); assert.equal(f.current().headerTheme, 'yellow');
});

test('a pathname change during exit cancels the previous page theme restore in isolation', () => {
  const f = mount({ syncRoute: false }); f.open(); f.close(); f.navigate('/contact'); f.clock.advance(450);
  assert.equal(f.current().headerTheme, 'green');
});

test('unmount during exit cancels every pending menu timer', () => {
  const f = mount(); f.open(); f.close(); f.unmount();
  assert.equal(f.clock.pending(), 0); f.clock.advance(450);
});

test('a pathname change from header navigation closes an open menu', () => {
  const f = mount({ syncRoute: true }); f.open(); f.navigate('/contact');
  assert.equal(f.current().open, false); f.clock.advance(450);
  assert.equal(f.current().headerTheme, 'yellow');
});

test('menu navigation closes while preserving its exact six routes and active Work label', () => {
  const f = mount(); f.open();
  const links = [...document.querySelectorAll('#site-menu .Menu_item__fjHgD')];
  assert.deepEqual(links.map(node => [node.textContent, node.getAttribute('href')]), [
    ['Home', '/'], ['Work', '/work'], ['About', '/about'], ['Ventures', '/ventures'],
    ['Careers', '/careers'], ['Contact', '/contact'],
  ]);
  assert.equal(links[1].getAttribute('aria-current'), 'page');
  assert.equal(links[1].firstChild.className, 'font-serif italic');
  f.click(links[5]); assert.equal(f.current().open, false);
});

test('menu release leaves another scroll-lock owner intact and restores the original scroll last', () => {
  const f = mount(); const restored = [];
  Object.defineProperty(window, 'pageYOffset', { value: 3407, configurable: true });
  window.scrollTo = (x, y) => restored.push([x, y]);
  theme.acquireScrollLock('test:lightbox'); f.open();
  assert.equal(theme.scrollLockOwnerCount(), 2); assert.equal(document.body.style.top, '-3407px');
  f.close(); assert.deepEqual(theme.scrollLockOwners(), ['test:lightbox']);
  assert.equal(document.documentElement.style.overflow, 'hidden');
  theme.releaseScrollLock('test:lightbox'); assert.equal(theme.isScrollLocked(), false);
  assert.deepEqual(restored, [[0, 3407]]); assert.equal(document.body.style.position, '');
  Object.defineProperty(window, 'pageYOffset', { value: 0, configurable: true });
});

test('StrictMode repeated open/close leaves no lock, timer, panel or stale green theme', () => {
  const f = mount({ strict: true });
  for (let index = 0; index < 8; index++) {
    f.open(); assert.equal(theme.scrollLockOwnerCount(), 1);
    f.close(); assert.equal(theme.scrollLockOwnerCount(), 0);
    f.clock.advance(100);
  }
  f.clock.advance(450);
  assert.equal(theme.scrollLockOwnerCount(), 0); assert.equal(f.clock.pending(), 0);
  assert.equal(document.getElementById('site-menu'), null); assert.equal(f.current().headerTheme, 'light');
});

test('REVIEW: same-route close keeps the pre-open section theme with real RouteThemeSync', () => {
  const f = mount({ syncRoute: true });
  f.navigate('/work/21st-century-gold-rush');
  f.headerTheme('dark');
  f.open();
  assert.equal(f.current().headerTheme, 'green');
  f.close();
  f.clock.advance(450);
  assert.equal(f.current().headerTheme, 'dark');
});

test('REVIEW: section update while open survives close with real RouteThemeSync', () => {
  const f = mount({ syncRoute: true });
  f.navigate('/work/21st-century-gold-rush');
  f.open();
  f.headerTheme('dark');
  assert.equal(f.current().headerTheme, 'green');
  f.close();
  f.clock.advance(450);
  assert.equal(f.current().headerTheme, 'dark');
});

test('REVIEW: close on About then reopen and navigate Contact preserves Contact ownership', () => {
  const f = mount({ syncRoute: true });
  f.navigate('/about');
  f.open(); f.close(); f.clock.advance(100); f.open();
  f.navigate('/contact'); f.clock.advance(450);
  assert.equal(f.current().open, false);
  assert.equal(f.current().headerTheme, 'yellow');
  assert.equal(theme.scrollLockOwnerCount(), 0);
});


test('same-route /work menu toggles preserve section themes with real RouteThemeSync', () => {
  const f = mount(); f.pageTheme('dark'); f.headerTheme('dark');
  f.open(); assert.equal(f.current().pageTheme, 'dark');
  f.close(); f.clock.advance(450); assert.equal(f.current().pageTheme, 'dark');
  assert.equal(f.current().headerTheme, 'dark');
});
