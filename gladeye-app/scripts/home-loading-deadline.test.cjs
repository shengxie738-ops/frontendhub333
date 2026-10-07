/* R1 bounded whole-load deadline regressions. Production TS,
 * real Three CPU objects, camera path, virtual-scroll and vignette execute.
 * Renderer, network, terrain placement, post-FX and Lenis are controlled.
 * mockedGPU: no browser/server/GPU/network or visual acceptance is implied.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { test } = require('node:test');
const appRoot = path.resolve(__dirname, '..');
const appRequire = createRequire(path.join(appRoot, 'package.json'));
const ts = appRequire('typescript');
const three = appRequire('three');
const sourceWhitelist = new Set([
  'experience/ValleyScene.ts', 'experience/data/scene-settings.ts',
  'experience/data/camera-path07.json', 'experience/lib/camera-path.ts',
  'experience/lib/math.ts', 'experience/lib/virtual-scroll.ts',
  'experience/lib/vignette-layer.ts',
]);

function fixture(options = {}) {
  const listeners = new Map(), frames = new Map(), timers = new Map();
  const textureRequests = [], images = [], renderers = [], lenisInstances = [];
  const progress = [], postFx = [], fbos = [], timerRequests = [];
  const initError = new Error(`controlled initialization failure: ${options.failureAt}`);
  function trip(point) { if (options.failureAt === point) throw initError; }
  const cleanupError = new Error(`controlled cleanup failure: ${options.disposeFailure}`);
  function cleanupTrip(point) { if (options.disposeFailure === point) throw cleanupError; }
  let now = 0, nextId = 0;
  const classes = new Set();
  const mountNode = {
    children: [], prepend(canvas) { canvas.parentElement = this; this.children.unshift(canvas); trip('canvas-mount'); },
    removeChild(canvas) { this.children = this.children.filter(x => x !== canvas); canvas.parentElement = null; },
  };
  const container = { scrollTop: 0, querySelector: () => mountNode };
  const window = {
    innerWidth: 1440, innerHeight: 900, devicePixelRatio: 1,
    performance: { now: () => now },
    addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); if (name === 'pointermove') trip('pointer-listener'); },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
    requestAnimationFrame(fn) { const id = ++nextId; frames.set(id, fn); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
  };
  const document = {
    hidden: false,
    documentElement: { classList: { add(x) { classes.add(x); trip('homepage-add'); }, remove: x => classes.delete(x), contains: x => classes.has(x) } },
    createElement(name) { assert.equal(name, 'canvas'); return { getContext: () => null }; },
  };
  class Renderer {
    constructor() {
      if (options.rendererThrows) throw new Error('controlled renderer constructor failure');
      this.domElement = new EventTarget(); this.domElement.parentElement = null;
      this.disposed = false; this.disposeCalls = 0; this.compileCalls = 0; this.renderCalls = 0; renderers.push(this);
    }
    set outputColorSpace(value) { this.colorSpace = value; trip('renderer-config'); }
    setPixelRatio() {}
    setSize() { trip('renderer-size'); }
    compile() {
      this.compileCalls++;
      if (options.compileThrows) throw new Error('controlled compile exception');
      if (options.shaderError) contextConsole.error('THREE.WebGLProgram: shader compile failed');
    }
    setRenderTarget() {}
    clear() {}
    render() { this.renderCalls++; if (options.renderThrows) throw new Error('controlled frame failure'); }
    dispose() { this.disposed = true; this.disposeCalls++; trip('renderer-cleanup'); cleanupTrip('renderer'); }
  }
  class Loader {
    load(url, onLoad, _onProgress, onError) {
      const texture = new three.Texture({ width: 8, height: 8 });
      let disposeCalls = 0; texture.addEventListener('dispose', () => { disposeCalls++; if (url === '/valley/flowers/pool_summer.png') cleanupTrip('texture'); });
      if (url === options.loaderThrowsUrl) throw new Error('controlled loader throw');
      textureRequests.push({ url, onLoad, onError, texture, isDisposed: () => disposeCalls > 0, disposeCalls: () => disposeCalls });
      return texture;
    }
  }
  class Image {
    constructor() { this.width = 8; this.height = 8; images.push(this); }
    set src(value) { this.url = value; }
  }
  class Lenis {
    constructor() {
      if (options.lenisThrows) throw new Error('controlled Lenis constructor failure');
      trip('lenis-constructor');
      this.destroyed = false; this.destroyCalls = 0; lenisInstances.push(this);
    }
    on() {}
    destroy() { this.destroyed = true; this.destroyCalls++; cleanupTrip('scroller'); }
  }
  class RenderTarget extends three.WebGLRenderTarget {
    constructor(...args) { super(...args); this.disposeCalls = 0; fbos.push(this); }
    dispose() { this.disposeCalls++; super.dispose(); }
  }
  class Clock extends three.Clock {
    getDelta() { if (lenisInstances.length) trip('scene-clock'); return super.getDelta(); }
  }
  const contextConsole = { error() {}, warn() {}, log() {} };
  const context = vm.createContext({ window, document, Image, Event, EventTarget, Error,
    performance: window.performance, console: contextConsole,
    setTimeout(fn, delay = 0) {
      const id = ++nextId, timer = { id, fn, due: now + delay, delay, cleared: false };
      timers.set(id, timer); timerRequests.push(timer); return id;
    },
    clearTimeout(id) { const timer = timers.get(id); if (timer) timer.cleared = true; timers.delete(id); },
  });
  const modules = new Map();
  function load(relative) {
    assert.ok(sourceWhitelist.has(relative), `not on the exact source whitelist: ${relative}`);
    if (modules.has(relative)) return modules.get(relative).exports;
    const filename = path.join(appRoot, 'src', relative);
    if (relative.endsWith('.json')) return JSON.parse(fs.readFileSync(filename, 'utf8'));
    const module = { exports: {} }; modules.set(relative, module);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    function localRequire(name) {
      if (name === 'react/jsx-runtime') return appRequire(name);
      if (name === '@/experience/data/scene-settings') return load('experience/data/scene-settings.ts');
      if (name.endsWith('flower-valley.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_target, key) => String(key) }) };
      if (name === 'three') return { ...three, WebGLRenderer: Renderer, TextureLoader: Loader, WebGLRenderTarget: RenderTarget, Clock };
      if (name === 'lenis') return { __esModule: true, default: Lenis };
      if (name.endsWith('/glsl')) return { shaderPair: () => ({ vertexShader: '', fragmentShader: '' }) };
      if (name.endsWith('/audio-manager')) return { audioStore: { updateVolume() {}, muffleBG() {}, muteBackgroundMusic() {} } };
      if (name.endsWith('/dust-field')) return { DustField: class {} };
      if (name.endsWith('/god-rays')) return { GodRays: class {} };
      if (name.endsWith('/field-probe')) return { probeField: () => null };
      if (name.endsWith('/sort-by-depth')) return { sortByCameraDepth() {} };
      if (name.endsWith('/terrain-lookup')) return { terrainLookUp() {
        const p = {};
        for (const key of ['aValleySides', 'aIsFloorDiscards', 'isFirstRow', 'aSpriteScales', 'random',
          'aPoolId', 'aIsFloorPool', 'aTerrainNoise', 'aYNoise', 'aFlowerGrowNoise']) p[key] = [0];
        p.noiseCoordinates = [0, 0, 0]; p.positions = [0, 0, 0]; p.aColorCoordinates = [0, 0]; return p;
      } };
      if (name.endsWith('/post-fx')) return {
        createPostFX(renderer) {
          trip('postfx-create');
          const fx = { disposed: false, disposeCalls: 0, composer: { render() { renderer.render(); }, renderToScreen: true }, noiseUniforms: {
            uNoiseDensityThreshold: { value: 0 }, time: { value: 0 }, res: { value: [0, 0] }, intensity: { value: 1 },
          } }; postFx.push(fx); return fx;
        },
        resizePostFX() { trip('postfx-resize'); }, disposePostFX(fx) { fx.disposed = true; fx.disposeCalls++; cleanupTrip('postfx'); },
      };
      const base = path.posix.normalize(path.posix.join(path.posix.dirname(relative), name));
      for (const suffix of ['', '.ts', '.json']) if (sourceWhitelist.has(base + suffix)) return load(base + suffix);
      throw new Error(`module outside whitelist: ${name} from ${relative}`);
    }
    vm.runInContext(`(function(require,module,exports){${code}\n})`, context, { filename })(localRequire, module, module.exports);
    return module.exports;
  }
  const scene = load('experience/ValleyScene.ts');
  if (options.failureAt === 'uniforms-init') {
    const original = scene.FlowerValleyScene.prototype.buildUniforms;
    scene.FlowerValleyScene.prototype.buildUniforms = function() { trip('uniforms-init'); return original.call(this); };
  }
  function create(extra = {}) { return new scene.HomeExperience({ container, onProgress: (loaded, total) => progress.push({ loaded, total }), ...extra }); }
  async function drain() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
  async function textures({ fail, hang } = {}) {
    for (const r of textureRequests) {
      if (r.url === hang) continue;
      if (r.url === fail) r.onError(new Error('controlled texture failure'));
      else r.onLoad(r.texture);
    }
    await drain();
  }
  async function ready(experience) { await textures(); assert.equal(images.length, 1); images[0].onload(); await drain(); assert.equal(experience.status, 'ready'); }
  function runFrame() { const [id, callback] = frames.entries().next().value; frames.delete(id); now += 16.7; callback(now); }
  return { ...scene, create, ready, textures, drain, frames, timers, listeners, classes, container,
    mountNode, renderers, textureRequests, images, progress, postFx, lenisInstances, document, window, fbos, initError, cleanupError, timerRequests,
    jump(ms) { now += ms; },
    advance(ms) {
      const target = now + ms;
      for (;;) {
        const timer = [...timers.values()].filter(t => t.due <= target).sort((a, b) => a.due - b.due || a.id - b.id)[0];
        if (!timer) break;
        timers.delete(timer.id); now = timer.due; timer.fn();
      }
      now = target;
    }, runFrame, count: name => listeners.get(name)?.size ?? 0,
    loadVirtual: () => load('experience/lib/virtual-scroll.ts'),
  };
}

const DEADLINE = 30000;
const SPRITE = '/valley/flowers/pool_summer.png';
const RAY = '/valley/rays/ray3.png';

function assertReleased(f, e) {
  assert.equal(f.frames.size, 0, 'no owner RAF survives');
  assert.equal(f.timers.size, 0, 'no deadline or resize timer survives');
  assert.equal(f.count('resize'), 0); assert.equal(f.count('pointermove'), 0);
  assert.equal(f.mountNode.children.length, 0); assert.equal(f.classes.size, 0);
  for (const renderer of f.renderers) assert.equal(renderer.disposeCalls, 1);
  for (const fx of f.postFx) assert.equal(fx.disposeCalls, 1);
  for (const fbo of f.fbos) assert.equal(fbo.disposeCalls, 1);
  for (const lenis of f.lenisInstances) assert.equal(lenis.destroyCalls, 1);
  assert.equal(e.getDiagnostics().runtimes, 0);
}
function assertTimedOut(f, e, url, kind) {
  assert.equal(e.status, 'failed', 'whole-load deadline ends loading');
  assert.equal(e.valleyReady, false); assert.equal(e.getDiagnostics().mode, 'poster');
  assert.equal(e.getDiagnostics().degraded, true);
  assert.deepEqual(Array.from(e.degradeReasons), ['asset-load-failed']);
  assert.equal(e.failures.length, 1);
  assert.equal(e.failures[0].url, url); assert.equal(e.failures[0].kind, kind);
  assert.match(e.failures[0].message, /timeout/i);
  assert.match(e.failures[0].message, /30000/);
  assert.doesNotMatch(e.failures[0].message, /decode|image failed/i);
  assert.equal(e.valleyScene.points, null); assert.equal(e.valleyScene.vignette, null);
  assert.equal(e.valleyScene.cameraAnim, null); assert.equal(e.renderer.compileCalls, 0);
  assertReleased(f, e);
}
function assertNoLatePublication(f, e, count) {
  assert.equal(e.status, 'failed'); assert.equal(e.valleyReady, false);
  assert.equal(f.progress.length, count, 'late results do not publish progress');
  assert.equal(e.valleyScene.points, null); assert.equal(e.valleyScene.vignette, null);
  assert.equal(e.renderer.compileCalls, 0); assertReleased(f, e);
}

test('R1: a hanging optional ray ends loading at one 30000ms whole-load deadline', async () => {
  const f = fixture(), e = f.create(); await f.textures({ hang: RAY });
  assert.equal(f.textureRequests.length, 7); assert.equal(f.images.length, 0);
  f.advance(DEADLINE - 1); await f.drain(); assert.equal(e.status, 'loading');
  f.advance(1); await f.drain(); assertTimedOut(f, e, RAY, 'texture');
  assert.equal(f.timerRequests.length, 1); assert.equal(f.timerRequests[0].delay, DEADLINE);
  for (const r of f.textureRequests.filter(r => r.url !== RAY)) assert.equal(r.disposeCalls(), 1);
  const count = f.progress.length, late = f.textureRequests.find(r => r.url === RAY);
  late.onLoad(late.texture); await f.drain(); assert.equal(late.disposeCalls(), 1);
  e.markValleyReady(); f.advance(DEADLINE * 2); await f.drain();
  assertNoLatePublication(f, e, count); assert.equal(f.images.length, 0);
  assert.equal(f.textureRequests.length, 7, 'timeout never retries');
});

test('R1: all seven hanging textures dispose every late success without terrain or ready', async () => {
  const f = fixture(), e = f.create(); f.advance(DEADLINE); await f.drain();
  assertTimedOut(f, e, SPRITE, 'texture'); const count = f.progress.length;
  await f.textures(); assertNoLatePublication(f, e, count);
  for (const r of f.textureRequests) assert.equal(r.disposeCalls(), 1);
  assert.equal(f.images.length, 0);
});

for (const outcome of ['onload', 'onerror']) test(`R1: hanging terrain times out and ignores late ${outcome}`, async () => {
  const f = fixture(), e = f.create(); await f.textures(); assert.equal(f.images.length, 1);
  const terrain = f.images[0], count = f.progress.length;
  f.advance(DEADLINE); await f.drain(); assertTimedOut(f, e, terrain.url, 'image-data');
  terrain[outcome](); await f.drain(); assertNoLatePublication(f, e, count);
  for (const r of f.textureRequests) assert.equal(r.disposeCalls(), 1);
  assert.equal(f.images.length, 1, 'timeout never retries terrain');
});

test('R1: terrain shares the original budget after textures consume 25000ms', async () => {
  const f = fixture(), e = f.create(); f.advance(25000); await f.textures();
  assert.equal(f.images.length, 1); f.advance(4999); await f.drain(); assert.equal(e.status, 'loading');
  f.advance(1); await f.drain(); assertTimedOut(f, e, f.images[0].url, 'image-data');
  assert.equal(f.timerRequests.length, 1, 'no new 30-second layer budget');
});

test('R1: successful load clears its deadline and a saved expired callback cannot fail ready', async () => {
  const f = fixture(), e = f.create();
  assert.equal(f.timerRequests.length, 1, 'loading schedules one deadline');
  const expiry = f.timerRequests[0]; await f.ready(e);
  assert.equal(f.timers.size, 0); assert.equal(expiry.delay, DEADLINE); assert.equal(expiry.cleared, true);
  const count = f.progress.length; expiry.fn(); f.advance(DEADLINE * 2); await f.drain();
  assert.equal(e.status, 'ready'); assert.equal(e.valleyReady, true); assert.equal(e.failures.length, 0);
  assert.equal(f.progress.length, count); assert.equal(f.frames.size, 1); e.destroy(); assertReleased(f, e);
});

for (const errorKind of ['sprite', 'terrain', 'loader-throw']) test(`R1: explicit ${errorKind} failure clears deadline without relabeling it timeout`, async () => {
  const options = errorKind === 'loader-throw' ? { loaderThrowsUrl: '/valley/rays/ray1.png' } : {};
  const f = fixture(options), e = f.create();
  if (errorKind === 'sprite') await f.textures({ fail: SPRITE });
  else if (errorKind === 'terrain') { await f.textures(); f.images[0].onerror(); await f.drain(); }
  else await f.drain();
  assert.equal(e.status, 'failed'); assert.equal(f.timers.size, 0);
  assert.equal(e.failures.length, 1); assert.doesNotMatch(e.failures[0].message, /timeout/i);
  assert.equal(f.timerRequests.length, 1, 'explicit failure had one bounded deadline');
  f.timerRequests[0].fn(); f.advance(DEADLINE); await f.drain();
  assert.equal(e.failures.length, 1); e.destroy();
  for (const request of f.textureRequests) if (!request.isDisposed()) request.onLoad(request.texture);
  await f.drain(); assertReleased(f, e);
});

for (const stage of ['textures', 'terrain']) test(`R1: unload during ${stage} clears deadline and never publishes a timeout`, async () => {
  const f = fixture(), e = f.create();
  if (stage === 'terrain') await f.textures();
  assert.equal(f.timerRequests.length, 1, 'pending load owns a deadline');
  const expiry = f.timerRequests[0], count = f.progress.length;
  e.destroy(); assertReleased(f, e); assert.equal(expiry.cleared, true);
  expiry.fn(); f.advance(DEADLINE); await f.drain();
  if (stage === 'textures') await f.textures();
  else { f.images[0].onload(); await f.drain(); }
  assert.equal(e.failures.length, 0); assert.notEqual(e.status, 'ready');
  assert.equal(f.progress.length, count); assertReleased(f, e);
});

test('R1: timeout wins when terrain completion is queued but ready has not settled', async () => {
  const f = fixture(), e = f.create(); await f.textures(); f.advance(DEADLINE - 1);
  f.images[0].onload(); f.advance(1); await f.drain();
  assertTimedOut(f, e, f.images[0].url, 'image-data');
});

test('R1: settled ready at the deadline boundary cancels timeout before it can run', async () => {
  const f = fixture(), e = f.create(); await f.textures(); f.jump(DEADLINE);
  f.images[0].onload(); await f.drain(); assert.equal(e.status, 'ready');
  f.advance(0); await f.drain(); assert.equal(e.status, 'ready'); assert.equal(e.failures.length, 0);
  assert.equal(f.timers.size, 0); e.destroy(); assertReleased(f, e);
});

test('R1: timeout during the build await releases acquired scene resources before late build settles', async () => {
  const f = fixture(), e = f.create(); await f.textures();
  const original = e.valleyScene.buildScene.bind(e.valleyScene); let finishBuild;
  const gate = new Promise(resolve => { finishBuild = resolve; });
  e.valleyScene.buildScene = async image => { await original(image); await gate; };
  f.images[0].onload(); await f.drain(); assert.ok(e.valleyScene.points);
  let geometryDisposals = 0, materialDisposals = 0, vignetteDisposals = 0;
  e.valleyScene.points.geometry.addEventListener('dispose', () => geometryDisposals++);
  e.valleyScene.points.material.addEventListener('dispose', () => materialDisposals++);
  e.valleyScene.vignette.mesh.geometry.addEventListener('dispose', () => vignetteDisposals++);
  const count = f.progress.length; f.advance(DEADLINE); await f.drain();
  assertTimedOut(f, e, f.images[0].url, 'image-data');
  assert.equal(geometryDisposals, 1); assert.equal(materialDisposals, 1); assert.equal(vignetteDisposals, 1);
  finishBuild(); await f.drain(); assertNoLatePublication(f, e, count);
});

for (const disposeFailure of ['texture', 'postfx', 'scroller', 'renderer']) test(`R1: ${disposeFailure} cleanup exception cannot hide timeout or leave remaining owners`, async () => {
  const f = fixture({ disposeFailure }), e = f.create(); await f.textures();
  f.advance(DEADLINE); await f.drain(); assertTimedOut(f, e, f.images[0].url, 'image-data');
  for (const r of f.textureRequests) assert.equal(r.disposeCalls(), 1);
  e.destroy(); assertReleased(f, e);
});

test('R1 REVIEW: queued final texture completion cannot attribute timeout to unrequested terrain', async () => {
  const f = fixture(), e = f.create(); f.advance(DEADLINE - 1);
  for (const r of f.textureRequests) r.onLoad(r.texture);
  assert.equal(f.images.length, 0, 'terrain has not been requested before the batch continuation');
  f.advance(1); await f.drain();
  assertTimedOut(f, e, SPRITE, 'texture');
  assert.match(e.failures[0].message, /texture batch/i);
  assert.equal(f.images.length, 0);
  for (const r of f.textureRequests) assert.equal(r.disposeCalls(), 1);
});
