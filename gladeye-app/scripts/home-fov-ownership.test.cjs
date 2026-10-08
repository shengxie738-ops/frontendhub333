/* FOV baseline ownership regressions. Production TS and real Three CPU camera,
 * matrices, uniforms, ShaderMaterial and lifecycle methods execute. Browser
 * timers, renderer, network, terrain input and post-FX are controlled; no GPU,
 * browser/server/network or pixel/animation acceptance is implied.
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
const whitelist = new Set([
  'ValleyScene.ts', 'data/scene-settings.ts', 'data/camera-path07.json',
  'lib/camera-path.ts', 'lib/math.ts', 'lib/virtual-scroll.ts',
  'lib/vignette-layer.ts', 'lib/sort-by-depth.ts',
]);

function fixture(t) {
  let now = 0, nextId = 0;
  const timers = new Map(), frames = new Map(), listeners = new Map();
  const timerRequests = [], sizeRequests = [], fxResizes = [], scenes = [], managers = [];
  const mount = { prepend(canvas) { canvas.parentElement = this; }, removeChild(canvas) { canvas.parentElement = null; } };
  const container = { scrollTop: 0, querySelector: () => mount };
  const window = {
    innerWidth: 1440, innerHeight: 900, devicePixelRatio: 1,
    performance: { now: () => now },
    addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
    requestAnimationFrame(fn) { const id = ++nextId; frames.set(id, fn); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
  };
  const document = {
    documentElement: { classList: { add() {}, remove() {}, contains: () => false } },
  };
  class Renderer {
    constructor() { this.domElement = new EventTarget(); this.domElement.parentElement = null; this.disposeCalls = 0; }
    setPixelRatio(dpr) { this.dpr = dpr; }
    setSize(width, height) { sizeRequests.push([width, height]); }
    dispose() { this.disposeCalls++; }
  }
  class Loader {
    load() { return new three.Texture(); } // Pending input is cancelled by production destroy().
  }
  class Lenis { on() {} destroy() {} }
  const context = vm.createContext({ window, document, EventTarget, console,
    performance: window.performance,
    setTimeout(fn, delay) {
      const id = ++nextId, timer = { id, fn, delay, due: now + delay };
      timers.set(id, timer); timerRequests.push(timer); return id;
    },
    clearTimeout(id) { timers.delete(id); },
  });
  const modules = new Map();
  function load(relative) {
    assert.ok(whitelist.has(relative), `outside exact source whitelist: ${relative}`);
    if (modules.has(relative)) return modules.get(relative).exports;
    const filename = path.join(appRoot, 'src/experience', relative);
    if (relative.endsWith('.json')) return JSON.parse(fs.readFileSync(filename, 'utf8'));
    const module = { exports: {} }; modules.set(relative, module);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    function localRequire(name) {
      if (name === 'three') return { ...three, WebGLRenderer: Renderer, TextureLoader: Loader };
      if (name === 'lenis') return { __esModule: true, default: Lenis };
      if (name.endsWith('/glsl')) return { shaderPair(role) {
        const base = { flower: 'flower-valley.points', vignette: 'vignette' }[role];
        assert.ok(base, `unexpected shader role: ${role}`);
        return { vertexShader: fs.readFileSync(path.join(appRoot, 'src/experience/glsl', `${base}.vertex.glsl`), 'utf8'),
          fragmentShader: fs.readFileSync(path.join(appRoot, 'src/experience/glsl', `${base}.fragment.glsl`), 'utf8') };
      } };
      if (name.endsWith('/audio-manager')) return { audioStore: { updateVolume() {}, muffleBG() {}, muteBackgroundMusic() {} } };
      if (name.endsWith('/dust-field')) return { DustField: class {} };
      if (name.endsWith('/god-rays')) return { GodRays: class {} };
      if (name.endsWith('/field-probe')) return { probeField: () => null };
      if (name.endsWith('/terrain-lookup')) return { terrainLookUp() {
        const placement = {};
        for (const key of ['aValleySides', 'aIsFloorDiscards', 'isFirstRow', 'aSpriteScales', 'random',
          'aPoolId', 'aIsFloorPool', 'aTerrainNoise', 'aYNoise', 'aFlowerGrowNoise']) placement[key] = [0];
        placement.positions = [0, 0, -10]; placement.noiseCoordinates = [0, 0, 0]; placement.aColorCoordinates = [0, 0];
        return placement;
      } };
      if (name.endsWith('/post-fx')) return {
        createPostFX: () => ({ noiseUniforms: { uNoiseDensityThreshold: { value: 0 }, time: { value: 0 } } }),
        resizePostFX: (_fx, ...size) => fxResizes.push(size), disposePostFX() {},
      };
      const base = path.posix.normalize(path.posix.join(path.posix.dirname(relative), name));
      for (const suffix of ['', '.ts', '.json']) if (whitelist.has(base + suffix)) return load(base + suffix);
      throw new Error(`unapproved import: ${name} from ${relative}`);
    }
    vm.runInContext(`(function(require,module,exports){${code}\n})`, context, { filename })(localRequire, module, module.exports);
    return module.exports;
  }
  const { FlowerValleyScene, HomeExperience } = load('ValleyScene.ts');
  function scene() { const s = new FlowerValleyScene(container, false, 1, 1, {}); scenes.push(s); return s; }
  function manager() { const e = new HomeExperience({ container }); managers.push(e); return e; }
  function frame(s, delta = 1) {
    s.hasStartedAnimatingIn = true; s.isAnimatedIn = true;
    s.clock = { getDelta: () => delta, getElapsedTime: () => now / 1000 };
    s.onFrame();
  }
  function resizeManager(e) {
    for (const listener of listeners.get('resize') ?? []) listener();
  }
  function advance(ms) {
    const target = now + ms;
    for (;;) {
      const timer = [...timers.values()].filter(x => x.due <= target).sort((a, b) => a.due - b.due || a.id - b.id)[0];
      if (!timer) break;
      timers.delete(timer.id); now = timer.due; timer.fn();
    }
    now = target;
  }
  t.after(() => { for (const e of managers) e.destroy(); for (const s of scenes) s.dispose(); });
  return { scene, manager, frame, resizeManager, advance, window, timers, frames, timerRequests, sizeRequests, fxResizes,
    cameraAnimator: s => new (load('lib/camera-path.ts').CameraAnimator)(s.cameraContainer) };
}

function close(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-10, `${message}: expected ${expected}, got ${actual}`);
}
function canonical(s) {
  close(s.cameraFov, 27, 'unmodulated camera baseline');
  close(s.uniforms.uCamFovBase.value, 27, 'unmodulated shader baseline');
}
function displayed(s, expected) {
  close(s.camera.fov, expected, 'display camera FOV');
  close(s.uniforms.uCamFov.value, expected, 'display shader FOV');
  const expectedCamera = new three.PerspectiveCamera(expected, s.camera.aspect, s.camera.near, s.camera.far);
  for (let i = 0; i < 16; i++) close(s.camera.projectionMatrix.elements[i], expectedCamera.projectionMatrix.elements[i], `projection element ${i}`);
}

test('FOV: construction owns the canonical baseline before any resize or hover frame', t => {
  const f = fixture(t), s = f.scene(); canonical(s);
  s.buttonHover = true; f.frame(s); canonical(s); displayed(s, 59.4);
});

test('FOV: hovered manager resize preserves base on immediate and 50ms updates then restores on roll-out', t => {
  const f = fixture(t), e = f.manager(), s = e.valleyScene;
  e.startHoverTransition(); f.frame(s); displayed(s, 59.4);
  f.window.innerWidth = 1366; f.window.innerHeight = 768;
  f.resizeManager(e); canonical(s); f.frame(s); displayed(s, 59.4);
  const beforeDelayed = f.sizeRequests.length;
  f.advance(49); assert.equal(f.sizeRequests.length, beforeDelayed);
  f.advance(1); assert.equal(f.sizeRequests.length, beforeDelayed + 1); canonical(s);
  f.frame(s); displayed(s, 59.4);
  e.stopHoverTransition(); f.frame(s); canonical(s); displayed(s, 27);
});

test('FOV: partial hover and roll-out keep the existing delta-based easing through resize', t => {
  const f = fixture(t), s = f.scene(); s.updateSize(); s.buttonHover = true;
  f.frame(s, 1 / 60); close(s.buttonHoverProgress, 1 / 6, 'existing hover ease'); displayed(s, 32.4);
  s.resize(); canonical(s); f.advance(50); f.frame(s, 1 / 60);
  close(s.buttonHoverProgress, 11 / 36, 'next hover ease'); displayed(s, 36.9);
  s.buttonHover = false; f.frame(s, 1 / 60);
  close(s.buttonHoverProgress, (11 / 36) * 0.95, 'existing roll-out ease');
  displayed(s, 27 * (1 + (11 / 36) * 0.95 * 1.2));
  f.frame(s); canonical(s); displayed(s, 27);
});

test('FOV: exit resize preserves canonical base and unchanged hover and extra modulation until disposal', t => {
  const f = fixture(t), e = f.manager(), s = e.valleyScene;
  e.startExitTransition(); f.frame(s, 1 / 60);
  close(s.extra, 1 / 30, 'existing exit ease'); close(s.buttonHoverProgress, 0.05, 'existing exit dispersal ease');
  displayed(s, 27 * (1 + 0.05 * 1.2) - 20 / 30);
  f.resizeManager(e); canonical(s); f.advance(50); canonical(s);
  f.frame(s); displayed(s, 39.4); // Fully dispersed exit: 27*2.2 - 20.
  f.resizeManager(e); f.advance(50); f.frame(s); canonical(s); displayed(s, 39.4);
  e.destroy(); const next = f.scene(); canonical(next); f.frame(next); displayed(next, 27);
});

test('FOV: repeated resize and existing setQuality updateSize path cannot compound hovered FOV', t => {
  const f = fixture(t), e = f.manager(), s = e.valleyScene;
  e.startHoverTransition(); f.frame(s);
  for (const tier of ['boost', 'high', 'balanced', 'boost', 'high']) {
    e.setQuality(tier); f.resizeManager(e); f.advance(50); f.frame(s);
    canonical(s); displayed(s, 59.4); assert.equal(s.qualityTier, tier);
  }
  e.stopHoverTransition(); f.frame(s); canonical(s); displayed(s, 27);
});

test('FOV: real production flower material shares canonical and displayed uniforms after resize', async t => {
  const f = fixture(t), s = f.scene(); s.cameraAnim = f.cameraAnimator(s); await s.buildScene({ width: 1, height: 1 });
  assert.ok(s.points.material instanceof three.ShaderMaterial);
  assert.equal(s.points.material.uniforms, s.uniforms);
  const baseUniform = s.points.material.uniforms.uCamFovBase, displayUniform = s.points.material.uniforms.uCamFov;
  s.updateSize(); s.dispersalOverride = 0.5; f.frame(s); displayed(s, 43.2);
  s.resize(); f.advance(50); f.frame(s); canonical(s); displayed(s, 43.2);
  assert.equal(s.points.material.uniforms.uCamFovBase, baseUniform);
  assert.equal(s.points.material.uniforms.uCamFov, displayUniform);
  s.dispersalOverride = null; f.frame(s); canonical(s); displayed(s, 27);
});

test('FOV: ordinary resize still updates dimensions DPR far plane post-FX and projection', t => {
  const f = fixture(t), e = f.manager(), s = e.valleyScene;
  for (const [width, height, deviceDpr, expectedDpr, expectedFar] of [[1920, 1080, 2, 1, 77], [800, 700, 2, 2, 77], [500, 500, 2, 2, 140]]) {
    f.window.innerWidth = width; f.window.innerHeight = height; f.window.devicePixelRatio = deviceDpr;
    f.resizeManager(e); f.advance(50); f.frame(s); canonical(s); displayed(s, 27);
    assert.equal(s.camera.aspect, width / height); assert.equal(s.camera.far, expectedFar);
    assert.equal(s.pixelRatio, expectedDpr); assert.equal(s.uniforms.uComposerPixelRatio.value, expectedDpr);
    assert.deepEqual(s.uniforms.res.value.toArray(), [width, height]);
    assert.deepEqual(s.uniforms.uResolution.value.toArray(), [width, height]);
    assert.equal(s.fbo.width, width); assert.equal(s.fbo.height, height);
    assert.deepEqual(f.sizeRequests.at(-1), [width, height]);
    if (expectedFar === 77) assert.deepEqual(f.fxResizes.at(-1), [width, height, expectedDpr]);
  }
});

for (const owner of ['scene', 'manager']) test(`FOV: ${owner} repeated resize cancels prior timer and disposal rejects late resize callbacks`, t => {
  const f = fixture(t), e = owner === 'manager' ? f.manager() : null, s = e ? e.valleyScene : f.scene();
  s.updateSize(); s.buttonHover = true; f.frame(s);
  const resize = () => e ? e.resize() : s.resize(); // Capture the production owner callback even after listener removal.
  resize(); const first = f.timerRequests.filter(x => x.delay === 50).at(-1);
  resize(); assert.equal(f.timers.has(first.id), false);
  const last = f.timerRequests.filter(x => x.delay === 50).at(-1);
  canonical(s); f.frame(s); displayed(s, 59.4);
  if (e) e.destroy(); else s.dispose();
  assert.equal(f.timers.size, 0); assert.equal(f.frames.size, 0);
  const snapshot = { fov: s.camera.fov, base: s.cameraFov, shaderBase: s.uniforms.uCamFovBase.value,
    projection: s.camera.projectionMatrix.toArray(), sizes: f.sizeRequests.length };
  f.window.innerWidth = 1920; f.window.innerHeight = 1080;
  first.fn(); last.fn(); resize(); f.advance(50);
  assert.deepEqual({ fov: s.camera.fov, base: s.cameraFov, shaderBase: s.uniforms.uCamFovBase.value,
    projection: s.camera.projectionMatrix.toArray(), sizes: f.sizeRequests.length }, snapshot);
  assert.equal(f.timers.size, 0);
});
