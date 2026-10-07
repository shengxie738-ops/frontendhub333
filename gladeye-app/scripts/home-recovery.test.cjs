/* R2/R3 owner regressions extracted from the recovery audit. Production TS,
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
  const progress = [], postFx = [], fbos = [];
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
    setTimeout(fn) { const id = ++nextId; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
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
    mountNode, renderers, textureRequests, images, progress, postFx, lenisInstances, document, window, fbos, initError, cleanupError,
    advance(ms) { now += ms; }, runFrame, count: name => listeners.get(name)?.size ?? 0,
    loadVirtual: () => load('experience/lib/virtual-scroll.ts'),
  };
}

function assertReleased(f) {
  assert.equal(f.frames.size, 0, 'no owner RAF survives');
  assert.equal(f.timers.size, 0, 'no resize timer survives');
  assert.equal(f.count('resize'), 0, 'no resize listener survives');
  assert.equal(f.count('pointermove'), 0, 'no pointer listener survives');
  assert.equal(f.mountNode.children.length, 0, 'owner canvas removed');
  assert.equal(f.classes.size, 0, 'homepage lock restored');
  for (const renderer of f.renderers) assert.equal(renderer.disposeCalls, 1);
  for (const fx of f.postFx) assert.equal(fx.disposeCalls, 1);
  for (const fbo of f.fbos) assert.equal(fbo.disposeCalls, 1);
  for (const lenis of f.lenisInstances) assert.equal(lenis.destroyCalls, 1);
}
function assertNoRevival(f, e, progressCount) {
  assert.notEqual(e.status, 'ready'); assert.equal(e.valleyReady, false);
  assert.equal(e.valleyScene.points, null); assert.equal(e.valleyScene.vignette, null);
  assert.equal(e.valleyScene.cameraAnim, null); assert.equal(e.renderer.compileCalls, 0);
  assert.equal(f.progress.length, progressCount, 'no post-disposal progress');
  assertReleased(f); assert.equal(e.getDiagnostics().runtimes, 0);
}

test('R2: destroy before texture completion disposes each late result without terrain/build/ready', async () => {
  const f = fixture(), e = f.create(), count = f.progress.length; e.destroy();
  await f.textures(); await f.drain();
  assert.equal(f.images.length, 0); assertNoRevival(f, e, count);
  for (const request of f.textureRequests) assert.equal(request.disposeCalls(), 1);
  e.markValleyReady(); e.destroy(); assertNoRevival(f, e, count);
});

test('R2: destroy releases already completed textures while other requests are still pending', async () => {
  const f = fixture(), e = f.create(); f.textureRequests[0].onLoad(f.textureRequests[0].texture);
  await f.drain(); e.destroy();
  assert.equal(f.textureRequests[0].disposeCalls(), 1, 'resolved pending texture is owned before Promise.all completes');
  for (const request of f.textureRequests.slice(1)) request.onLoad(request.texture);
  await f.drain(); assertNoRevival(f, e, 1);
  for (const request of f.textureRequests) assert.equal(request.disposeCalls(), 1);
});

for (const outcome of ['onload', 'onerror']) test(`R2: destroy at pending terrain ignores late ${outcome}`, async () => {
  const f = fixture(), e = f.create(); await f.textures(); assert.equal(f.images.length, 1);
  const count = f.progress.length; e.destroy(); f.images[0][outcome](); await f.drain();
  assertNoRevival(f, e, count); assert.equal(e.failures.length, 0, 'late failure is not published');
  for (const request of f.textureRequests) assert.equal(request.disposeCalls(), 1);
});

for (const boundary of [1, 8]) test(`R2: destroy at progress ${boundary} prevents the next synchronous resource acquisition`, async () => {
  const f = fixture(); let e;
  e = f.create({ onProgress(loaded) { f.progress.push({ loaded }); if (loaded === boundary) e.destroy(); } });
  await f.textures(); if (boundary === 8) { f.images[0].onload(); await f.drain(); }
  const count = f.progress.length; await f.drain();
  assert.equal(f.images.length, boundary === 8 ? 1 : 0); assertNoRevival(f, e, count);
  for (const request of f.textureRequests) assert.equal(request.disposeCalls(), 1);
});

test('R2: destroy at build await prevents ready and old resize/frame callbacks cannot acquire new work', async () => {
  const f = fixture(), e = f.create(); await f.textures();
  const resize = [...f.listeners.get('resize')];
  const buildScene = e.valleyScene.buildScene.bind(e.valleyScene);
  let finishBuild;
  const gate = new Promise(resolve => { finishBuild = resolve; });
  e.valleyScene.buildScene = async image => { await buildScene(image); await gate; };
  f.images[0].onload(); await f.drain();
  assert.ok(e.valleyScene.points, 'real build acquired resources before its await returned');
  e.destroy(); const count = f.progress.length; finishBuild();
  for (const callback of resize) callback();
  e.valleyScene.resize(); await f.drain();
  assertNoRevival(f, e, count);
});

test('R2: a rejected texture batch releases successes arriving after rejection', async () => {
  const f = fixture({ loaderThrowsUrl: '/valley/rays/ray1.png' }), e = f.create();
  f.textureRequests[0].onLoad(f.textureRequests[0].texture);
  await f.drain(); assert.equal(e.status, 'failed');
  for (const request of f.textureRequests.slice(1)) request.onLoad(request.texture);
  await f.drain();
  for (const request of f.textureRequests) assert.equal(request.disposeCalls(), 1);
  assert.equal(f.images.length, 0); assert.equal(e.valleyScene.points, null); e.destroy(); assertReleased(f);
});

for (const failureAt of ['uniforms-init', 'renderer-config', 'postfx-create', 'postfx-resize',
  'canvas-mount', 'homepage-add', 'renderer-size', 'pointer-listener', 'lenis-constructor', 'scene-clock']) {
  test(`R3: ${failureAt} rolls back each successfully acquired owner and preserves the original error`, () => {
    const options = { failureAt }, f = fixture(options);
    assert.throws(() => f.create(), error => error === f.initError);
    assertReleased(f);
    options.failureAt = null;
    const healthy = f.create(); assert.equal(healthy.getDiagnostics().runtimes, 1);
    healthy.destroy(); assert.equal(healthy.getDiagnostics().runtimes, 0); assertReleased(f);
  });
}

test('R3: rollback restores an already present homepage class', () => {
  const f = fixture({ failureAt: 'lenis-constructor' }); f.classes.add('homepage');
  assert.throws(() => f.create(), error => error === f.initError);
  assert.equal(f.classes.has('homepage'), true); f.classes.clear(); assertReleased(f);
});

test('protection: renderer constructor throw occurs before app ownership is acquired', () => {
  const f = fixture({ rendererThrows: true }); assert.throws(() => f.create(), /renderer constructor/);
  assert.equal(f.renderers.length, 0); assert.equal(f.fbos.length, 0); assertReleased(f);
});

test('protection: ready then repeated destroy releases resources once and ignores saved callbacks', async () => {
  const f = fixture(), e = f.create(); await f.ready(e); f.runFrame(); e.startExitTransition();
  for (const callback of f.listeners.get('resize')) callback(); assert.ok(f.timers.size > 0);
  // Only this package's manager/scene callbacks: the public scroller's stale RAF contract is a separate owner risk.
  const saved = [e.onFrame, f.frames.get(e.exitTweenRaf), ...f.timers.values(), ...f.listeners.get('resize')];
  let geometryDisposals = 0, materialDisposals = 0, vignetteDisposals = 0;
  e.valleyScene.points.geometry.addEventListener('dispose', () => geometryDisposals++);
  e.valleyScene.points.material.addEventListener('dispose', () => materialDisposals++);
  e.valleyScene.vignette.mesh.geometry.addEventListener('dispose', () => vignetteDisposals++);
  e.destroy(); e.destroy(); e.valleyScene.dispose();
  assertReleased(f); assert.equal(e.getDiagnostics().runtimes, 0);
  assert.equal(geometryDisposals, 1); assert.equal(materialDisposals, 1); assert.equal(vignetteDisposals, 1);
  for (const request of f.textureRequests) assert.equal(request.disposeCalls(), 1);
  for (const callback of saved) callback(); assertReleased(f);
});


test('R2 REVIEW: onScrollProgress destroying its owner within a frame leaves no new RAF', async () => {
  const f = fixture(); let e;
  e = f.create({ onScrollProgress() { e.destroy(); } });
  await f.ready(e); f.runFrame();
  assertReleased(f); assert.equal(e.getDiagnostics().runtimes, 0);
});

test('R3 REVIEW: rollback continues after acquired scroller cleanup throws and preserves the init error', () => {
  const f = fixture({ failureAt: 'scene-clock', disposeFailure: 'scroller' });
  assert.throws(() => f.create(), error => error === f.initError);
  assertReleased(f);
});

for (const disposeFailure of ['scroller', 'texture', 'postfx', 'renderer']) {
  test(`REVIEW: normal destroy continues after ${disposeFailure} cleanup fails and stays idempotent`, async () => {
    const f = fixture({ disposeFailure }), e = f.create(); await f.ready(e);
    assert.throws(() => e.destroy(), error => error === f.cleanupError);
    e.destroy(); e.valleyScene.dispose();
    assertReleased(f); assert.equal(e.getDiagnostics().runtimes, 0);
    for (const request of f.textureRequests) assert.equal(request.disposeCalls(), 1);
  });
}
