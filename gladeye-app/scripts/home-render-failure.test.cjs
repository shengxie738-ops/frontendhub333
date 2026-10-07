/* R4 shader/compile/frame terminal failure regressions. Production TS,
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
  const consoleErrors = [], consoleWarnings = [];
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
      options.onCompile?.(this);
      if (options.compileThrows) throw new Error('controlled compile exception');
      if (options.shaderErrorText) contextConsole.error(options.shaderErrorText);
      if (options.shaderWarning) contextConsole.warn(options.shaderWarning);
      if (options.unrelatedError) contextConsole.error(options.unrelatedError);
      if (options.shaderError) contextConsole.error('THREE.WebGLProgram: shader compile failed');
    }
    setRenderTarget() {}
    clear() {}
    render() { this.renderCalls++; options.onRender?.(this); if (options.renderThrows) throw new Error('controlled frame failure'); }
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
  const contextConsole = { error(...args) { consoleErrors.push(args); }, warn(...args) { consoleWarnings.push(args); }, log() {} };
  const originalConsoleError = contextConsole.error, originalConsoleWarn = contextConsole.warn;
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
    mountNode, renderers, textureRequests, images, progress, postFx, lenisInstances, document, window, fbos, initError, cleanupError, timerRequests, contextConsole, consoleErrors, consoleWarnings, originalConsoleError, originalConsoleWarn,
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

const THREE_SHADER_ERROR = 'THREE.WebGLProgram: Shader Error 1282 - VALIDATE_STATUS false\n\nProgram Info Log: controlled link failure';
const SPRITE = '/valley/flowers/pool_summer.png';
const RAY = '/valley/rays/ray3.png';

async function completeLoad(f) { await f.textures(); assert.equal(f.images.length, 1); f.images[0].onload(); await f.drain(); }
function assertReleased(f, e) {
  assert.equal(f.frames.size, 0, 'no manager, scroller or exit RAF survives');
  assert.equal(f.timers.size, 0, 'no deadline or resize timer survives');
  assert.equal(f.count('resize'), 0); assert.equal(f.count('pointermove'), 0);
  assert.equal(f.mountNode.children.length, 0); assert.equal(f.classes.size, 0);
  for (const renderer of f.renderers) assert.equal(renderer.disposeCalls, 1);
  for (const fx of f.postFx) assert.equal(fx.disposeCalls, 1);
  for (const fbo of f.fbos) assert.equal(fbo.disposeCalls, 1);
  for (const lenis of f.lenisInstances) assert.equal(lenis.destroyCalls, 1);
  for (const request of f.textureRequests) assert.equal(request.disposeCalls(), 1);
  assert.equal(e.valleyScene.points, null); assert.equal(e.valleyScene.vignette, null);
  assert.equal(e.valleyScene.cameraAnim, null); assert.equal(e.valleyScene.scroller, null);
  assert.equal(e.getDiagnostics().runtimes, 0);
}
function assertFailed(f, e, reason) {
  assert.equal(e.status, 'failed'); assert.equal(e.valleyReady, false);
  const diagnostic = e.getDiagnostics();
  assert.equal(diagnostic.mode, 'poster'); assert.equal(diagnostic.degraded, true);
  assert.deepEqual(Array.from(diagnostic.degradeReasons), [reason]);
  assert.equal(e.failures.length, 0, 'render failure is never a terrain/image-data failure');
  assert.equal(diagnostic.assetFailures.length, 0);
  assertReleased(f, e);
}
function assertShaderFailed(f, e, text) {
  assertFailed(f, e, 'shader-compile-failed');
  assert.equal(e.renderer.compileCalls, 1); assert.equal(e.renderer.renderCalls, 0);
  assert.equal(e.valleyScene.shaderIssues.length, 1);
  assert.equal(e.valleyScene.shaderIssues[0].stage, 'program');
  assert.match(e.valleyScene.shaderIssues[0].message, text);
  assert.equal(f.contextConsole.error, f.originalConsoleError); assert.equal(f.contextConsole.warn, f.originalConsoleWarn);
}
function watchResources(e) {
  const counts = { geometry: 0, material: 0, vignetteGeometry: 0, vignetteMaterial: 0 };
  e.valleyScene.points.geometry.addEventListener('dispose', () => counts.geometry++);
  e.valleyScene.points.material.addEventListener('dispose', () => counts.material++);
  e.valleyScene.vignette.mesh.geometry.addEventListener('dispose', () => counts.vignetteGeometry++);
  e.valleyScene.vignette.mesh.material.addEventListener('dispose', () => counts.vignetteMaterial++);
  return counts;
}
function assertSceneResourcesOnce(counts) { for (const count of Object.values(counts)) assert.equal(count, 1); }

for (const [name, options, text] of [
  ['identified shader compile diagnostic', { shaderError: true }, /shader compile failed/],
  ['installed Three r154 error signature', { shaderErrorText: THREE_SHADER_ERROR }, /controlled link failure/],
  ['compile exception', { compileThrows: true }, /controlled compile exception/],
]) test(`R4: ${name} is terminal shader failed/poster with no RAF or resources`, async () => {
  const f = fixture(options), e = f.create(); await completeLoad(f); assertShaderFailed(f, e, text);
  const count = f.progress.length, snapshot = JSON.stringify(e.getDiagnostics());
  e.markValleyReady(); e.onFrame(); e.destroy(); e.destroy(); e.valleyScene.dispose();
  f.timerRequests[0].fn(); await f.drain();
  assert.equal(JSON.stringify(e.getDiagnostics()), snapshot); assert.equal(f.progress.length, count); assertReleased(f, e);
});

test('R4: validation sees loading with no ready or RAF and only successful validation opens ready', async () => {
  const observed = [], options = { onCompile() { observed.push([e.status, e.valleyReady, f.frames.size]); } };
  const f = fixture(options), e = f.create(); await completeLoad(f);
  assert.deepEqual(observed, [['loading', false, 0]]);
  assert.equal(e.status, 'ready'); assert.equal(e.valleyReady, true); assert.equal(f.frames.size, 1);
  assert.equal(e.renderer.compileCalls, 1); assert.equal(e.renderer.renderCalls, 0);
  e.destroy(); assertReleased(f, e);
});

test('R4: manual ready during a pending build cannot bypass validation or start a loop', async () => {
  const f = fixture(), e = f.create(); await f.textures();
  const build = e.valleyScene.buildScene.bind(e.valleyScene); let finish;
  const gate = new Promise(resolve => { finish = resolve; });
  e.valleyScene.buildScene = async image => { await build(image); await gate; };
  f.images[0].onload(); await f.drain(); e.markValleyReady();
  assert.equal(e.status, 'loading'); assert.equal(e.valleyReady, false); assert.equal(f.frames.size, 0);
  assert.equal(e.renderer.compileCalls, 0); finish(); await f.drain();
  assert.equal(e.status, 'ready'); assert.equal(e.renderer.compileCalls, 1); assert.equal(f.frames.size, 1);
  e.destroy(); assertReleased(f, e);
});

for (const warning of [
  'THREE.WebGLProgram: Program Info Log: shader compiler optimization warning',
  'THREE.WebGLProgram: Shader Error warning text alone is not a failed link',
]) test(`R4: warning-only validation remains ready (${warning})`, async () => {
  const f = fixture({ shaderWarning: warning }), e = f.create(); await f.ready(e);
  assert.equal(e.valleyScene.shaderIssues.length, 0); assert.equal(e.getDiagnostics().mode, 'live');
  assert.equal(e.degradeReasons.length, 0); assert.equal(f.consoleWarnings.length, 1);
  assert.equal(f.consoleErrors.length, 0); e.destroy(); assertReleased(f, e);
});

test('R4: an unrelated error mentioning compile is not evidence of shader failure', async () => {
  const f = fixture({ unrelatedError: 'application compile cache refresh message' }), e = f.create(); await f.ready(e);
  assert.equal(e.valleyScene.shaderIssues.length, 0); assert.equal(e.degradeReasons.length, 0);
  assert.equal(f.consoleErrors.length, 1); assert.equal(f.consoleWarnings.length, 0);
  e.destroy(); assertReleased(f, e);
});

test('R4: recognized compile errors preserve error-channel forwarding and restore console hooks', async () => {
  const f = fixture({ shaderErrorText: THREE_SHADER_ERROR }), e = f.create(); await completeLoad(f);
  assert.equal(f.consoleErrors.length, 1); assert.equal(f.consoleWarnings.length, 0);
  assertShaderFailed(f, e, /Shader Error/);
});

test('R4: normal successful frame order and repeated ready calls preserve a single manager loop', async () => {
  const f = fixture(), e = f.create(); await f.ready(e);
  e.markValleyReady(); e.markValleyReady(); assert.equal(f.frames.size, 1); assert.equal(e.renderer.compileCalls, 1);
  const order = [];
  for (const [object, method, label] of [[e.valleyScene, 'onFrameAlwaysRun', 'always'], [e.valleyScene, 'onFrame', 'scene'],
    [e.valleyScene, 'render', 'render'], [e.clock, 'getDelta', 'clock']]) {
    const original = object[method].bind(object); object[method] = (...args) => { order.push(label); return original(...args); };
  }
  f.runFrame(); assert.deepEqual(order, ['always', 'scene', 'render', 'clock']);
  assert.equal(e.status, 'ready'); assert.equal(e.renderer.renderCalls, 1); assert.equal(f.frames.size, 2);
  assert.equal(e.valleyScene.uniforms.uSpriteSheetMix.value, 0.5);
  e.destroy(); assertReleased(f, e);
});

for (const failureAt of ['render', 'always-frame', 'scene-frame', 'manager-clock']) test(`R4: ${failureAt} exception is caught, terminates ready/live, and releases each owner once`, async () => {
  const f = fixture({ renderThrows: failureAt === 'render' }), e = f.create(); await f.ready(e);
  const counts = watchResources(e); e.startExitTransition();
  for (const callback of f.listeners.get('resize')) callback();
  if (failureAt === 'always-frame') e.valleyScene.onFrameAlwaysRun = () => { throw new Error('controlled always-frame failure'); };
  if (failureAt === 'scene-frame') e.valleyScene.onFrame = () => { throw new Error('controlled scene-frame failure'); };
  if (failureAt === 'manager-clock') e.clock.getDelta = () => { throw new Error('controlled clock failure'); };
  const saved = e.onFrame;
  assert.doesNotThrow(() => f.runFrame()); assertFailed(f, e, 'renderer-crashed'); assertSceneResourcesOnce(counts);
  const count = e.renderer.renderCalls; saved(); e.markValleyReady(); e.destroy(); e.valleyScene.dispose();
  assert.equal(e.renderer.renderCalls, count); assertFailed(f, e, 'renderer-crashed'); assertSceneResourcesOnce(counts);
  assert.equal(e.valleyScene.shaderIssues.length, 0);
});

for (const disposeFailure of ['scroller', 'texture', 'postfx', 'renderer']) {
  for (const failure of ['compile', 'frame']) test(`R4: ${failure} terminal failure survives ${disposeFailure} cleanup exceptions`, async () => {
    const f = fixture({ disposeFailure, compileThrows: failure === 'compile', renderThrows: failure === 'frame' }), e = f.create();
    await completeLoad(f);
    if (failure === 'frame') { assert.equal(e.status, 'ready'); assert.doesNotThrow(() => f.runFrame()); }
    assertFailed(f, e, failure === 'compile' ? 'shader-compile-failed' : 'renderer-crashed');
    e.destroy(); e.destroy(); e.valleyScene.dispose(); assertReleased(f, e);
  });
}

for (const compileThrows of [false, true]) test(`R4: destroy from compile prevents later ready/diagnostic writes (${compileThrows})`, async () => {
  const options = { compileThrows, shaderErrorText: THREE_SHADER_ERROR, onCompile() { e.destroy(); snapshot = JSON.stringify(e.getDiagnostics()); } };
  let snapshot; const f = fixture(options), e = f.create(); await completeLoad(f);
  assert.equal(e.status, 'loading'); assert.equal(e.valleyReady, false);
  assert.equal(JSON.stringify(e.getDiagnostics()), snapshot); assert.equal(e.valleyScene.shaderIssues.length, 0);
  assert.equal(e.degradeReasons.length, 0); assertReleased(f, e);
});

test('R4: onIntroDone destroying the owner stops remaining scene and manager frame writes', async () => {
  let afterDestroyProjectionCalls = 0, destroyed = false;
  const f = fixture(); let e;
  e = f.create({ onIntroDone() { e.destroy(); destroyed = true; } }); await f.ready(e);
  e.valleyScene.introCameraAngle = 0;
  const projection = e.valleyScene.camera.updateProjectionMatrix.bind(e.valleyScene.camera);
  e.valleyScene.camera.updateProjectionMatrix = () => { if (destroyed) afterDestroyProjectionCalls++; return projection(); };
  const initialFrameTimes = e.frameTimes.length;
  assert.doesNotThrow(() => f.runFrame()); assert.equal(afterDestroyProjectionCalls, 0);
  assert.equal(e.renderer.renderCalls, 0); assert.equal(e.frameTimes.length, initialFrameTimes); assert.equal(e.fps, 0);
  assert.equal(e.degradeReasons.length, 0); assertReleased(f, e);
});

test('R4: render callback destroying the owner prevents subsequent manager clock/metrics/RAF', async () => {
  const f = fixture({ onRender() { e.destroy(); } }), e = f.create(); await f.ready(e);
  let clockCalls = 0; e.clock.getDelta = () => { clockCalls++; return 0.016; };
  assert.doesNotThrow(() => f.runFrame()); assert.equal(clockCalls, 0); assert.equal(e.frameTimes.length, 0);
  assert.equal(e.fps, 0); assert.equal(e.degradeReasons.length, 0); assertReleased(f, e);
});

test('R4: a progress callback destroy plus throw cannot relabel an unloaded owner as failed', async () => {
  const f = fixture(); let e;
  e = f.create({ onScrollProgress() { e.destroy(); throw new Error('controlled callback throw after destroy'); } }); await f.ready(e);
  assert.doesNotThrow(() => f.runFrame()); assert.equal(e.status, 'ready'); assert.equal(e.degradeReasons.length, 0);
  assert.equal(e.failures.length, 0); assertReleased(f, e);
});

for (const stage of ['texture', 'terrain']) test(`R4/R1: ${stage} timeout stays asset classified and never reaches shader validation`, async () => {
  const f = fixture({ shaderError: true, compileThrows: true }), e = f.create();
  if (stage === 'texture') await f.textures({ hang: RAY }); else await f.textures();
  f.advance(30000); await f.drain();
  assert.equal(e.status, 'failed'); assert.equal(e.valleyReady, false);
  assert.deepEqual(Array.from(e.degradeReasons), ['asset-load-failed']);
  assert.equal(e.failures.length, 1); assert.match(e.failures[0].message, /timeout/);
  assert.equal(e.renderer.compileCalls, 0); assert.equal(e.valleyScene.shaderIssues.length, 0);
  if (stage === 'texture') { const late = f.textureRequests.find(r => r.url === RAY); late.onLoad(late.texture); }
  else f.images[0].onload(); await f.drain(); assertReleased(f, e);
});

test('R4: an optional texture failure remains distinct alongside terminal shader failure', async () => {
  const f = fixture({ shaderError: true }), e = f.create(); await f.textures({ fail: RAY }); f.images[0].onload(); await f.drain();
  assert.equal(e.status, 'failed'); assert.deepEqual(Array.from(e.degradeReasons), ['shader-compile-failed']);
  assert.equal(e.failures.length, 0); assert.equal(e.getDiagnostics().assetFailures.length, 1);
  assert.equal(e.getDiagnostics().assetFailures[0].url, RAY); assert.equal(e.getDiagnostics().assetFailures[0].kind, 'texture');
  // Failed network textures are never acquired; successful ones are each released.
  for (const request of f.textureRequests) assert.equal(request.disposeCalls(), request.url === RAY ? 0 : 1);
  assert.equal(f.frames.size, 0); assert.equal(e.getDiagnostics().runtimes, 0); e.destroy();
});

test('R4: initial ready clock exception is terminal renderer failure without an unhandled load rejection', async () => {
  const f = fixture(), e = f.create(); e.clock.getDelta = () => { throw new Error('controlled ready clock failure'); };
  await completeLoad(f); assertFailed(f, e, 'renderer-crashed'); assert.equal(e.renderer.compileCalls, 1);
});

test('R4: manager clock destroying its owner stops metrics and loop writes', async () => {
  const f = fixture(), e = f.create(); await f.ready(e);
  e.clock.getDelta = () => { e.destroy(); return 0.016; };
  assert.doesNotThrow(() => f.runFrame()); assert.equal(e.frameTimes.length, 0); assert.equal(e.fps, 0);
  assert.equal(e.degradeReasons.length, 0); assertReleased(f, e);
});
