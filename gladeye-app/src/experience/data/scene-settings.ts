/**
 * Every number the 3D scene needs, in one place.
 *
 * Nothing here is invented: each block cites the place it came from — either
 * `docs/research/gladeye/EVIDENCE.md` (§) or a byte offset into the original
 * compressed bundle `evidence/source-assets/js/app/page-4c279de0997d388f.js`
 * (written `page-<hash>.js:<offset>`) / `.../596-40a806be0d0d2bb3.js`
 * (`596-<hash>.js:<offset>`).
 *
 * `SCENE_SETTINGS` is asserted field-by-field against EVIDENCE.md §3 by
 * `gladeye-app/scripts/verify-scene-params.mjs`.
 */
import type { SceneSettings } from '../types';

/**
 * EVIDENCE.md §3 — the literal `this.settings` of the original scene class
 * (`page-4c279de0997d388f.js:12180`). Written as strict JSON inside the
 * markers so the verifier can `JSON.parse` both sides and diff them.
 */
export const SCENE_SETTINGS: SceneSettings = /* <VERIFIER:SCENE_SETTINGS> */ {
  "threshold": 0,
  "strength": 0.25,
  "radius": 0,
  "exposure": 1,
  "cameraMaxRotationX": 0,
  "cameraMaxRotationY": 0,
  "fovMultiplier": 1.2,
  "uCamNear": 10,
  "uCamFar": 77,
  "uTerrainOffsetX": 1,
  "uTerrainOffsetY": 0.33,
  "uFlowerBaseScale": 3853,
  "uLeavesBaseScale": 2500,
  "uFlowerBloomDistance": 24,
  "uLeafGrowDistance": 55,
  "uRepulsionStrength": 0.5,
  "uBrightnessOnTouch": 0.5,
  "uNegativeSpaceDeepness": 0.184,
  "uSpriteSheetMix": 0,
  "uSigmoidSteepness": 15,
  "uDustSize": 72,
  "uMaxAlpha": 0.05,
  "uFadeSpeed": 1.3,
  "cameraMaxDistanceDiff": 0,
  "cameraEase": 0.15,
  "fadingMouse": false,
  "mouseDebug": false,
  "uInteractionPositionOffset": 0.32,
  "uNoiseAlpha": 0.02,
  "uNoiseDensityThreshold": 0.5,
  "bloomParams": {
    "exposure": 1,
    "strength": 0.5,
    "threshold": 0.4,
    "radius": 0.2
  },
  "uMaxDispersedPosX": 100,
  "uMaxDispersedPosY": 65,
  "dispersalAmountMultiplier": 1.334,
  "dispersalRandomnessWeight": 0.53,
  "dispersalIsFlowerWeight": 0,
  "dispersalPositionYWeight": 0
} /* </VERIFIER:SCENE_SETTINGS> */;

/** EVIDENCE.md §3 / §4 — `new THREE.PerspectiveCamera(27, aspect, 1, settings.uCamFar)`. */
export const CAMERA = {
  fov: 27,
  near: 1,
  /** `settings.uCamFar` — becomes 140 under `useBoostPerformance` (page-…js:18780). */
  far: SCENE_SETTINGS.uCamFar,
  farBoostPerformance: 140,
  /** `this.camera.fov = cameraFov * (1 + hoverProgress*fovMultiplier) - 20*extra` */
  exitFovReduction: 20,
} as const;

/** GLB metadata (EVIDENCE.md §4, `camera-path07.glb.report.txt`). */
export const CAMERA_CLIP = {
  assetPath: '/valley/camera-path07.glb',
  jsonPath: 'src/experience/data/camera-path07.json',
  duration: 8.291666666666666,
  keyframes: 200,
  fps: 24,
  gltfYfovRad: 0.39959648408210363,
  gltfAspectRatio: 1.7777777777777777,
  gltfZnear: 0.1,
  gltfZfar: 1000,
  nodeRestRotation: [0, -0.03702882304787636, 0, 0.9993141889572144],
} as const;

/**
 * `CameraAnim` (EVIDENCE.md §4, page-…js:3300-4180):
 * `position.x/y` lerp 0.4, `position.z` lerps with `ease` which flips to 1 once
 * `|dz| > cameraMaxDistanceDiff`, `rotation.copy(gltfCam.rotation)`.
 */
export const CAMERA_ANIM = {
  positionEase: 0.4,
  defaultEase: 0.4,
  wrapEaseReset: 0.999,
  maxDistanceDiff: SCENE_SETTINGS.cameraMaxDistanceDiff,
  ease: SCENE_SETTINGS.cameraEase,
} as const;

/** EVIDENCE.md §5, page-…js:17440-18000 (`loadAssets`). Paths are identical to the live site. */
export const ASSETS = {
  cameraPath: 'valley/camera-path07.glb',
  spritePoolSummer: 'valley/flowers/pool_summer.png',
  spritePoolWinter: 'valley/flowers/pool_winter.png',
  vignette: 'valley/vignette.png',
  dustParticle: 'valley/dust-particle.png',
  ray1: 'valley/rays/ray1.png',
  ray2: 'valley/rays/ray2.png',
  ray3: 'valley/rays/ray3.png',
  terrain: 'valley/terrain.png',
  ambientAudio: 'valley/audio/ge-ambient.mp3',
  /** page-…js:880 — `dracoLoader.setDecoderPath('/assets/draco/')`. */
  dracoDecoderPath: '/assets/draco/',
  /** Order of `h.texture([...])` in `loadAssets` (page-…js:17570). */
  textureOrder: [
    'valley/flowers/pool_summer.png',
    'valley/flowers/pool_winter.png',
    'valley/vignette.png',
    'valley/dust-particle.png',
    'valley/rays/ray1.png',
    'valley/rays/ray2.png',
    'valley/rays/ray3.png',
  ],
} as const;

/**
 * EVIDENCE.md §5/§6 — sprite sheet layout, `page-…js:14560-14760`:
 * `uPoolSheetSize:(1500,1312)`, `uAmountOfSprites:(8,7)` and the per-pool
 * sprite-row ranges (row indices, `x` inclusive start, `y` inclusive end).
 */
export const SPRITE_SHEET = {
  poolSheetSize: [1500, 1312],
  amountOfSprites: [8, 7],
  startEndIndexPool_0: [0, 1],
  startEndIndexPool_1: [2, 2],
  startEndIndexPool_2: [3, 4],
  startEndIndexLeaves: [5, 5],
  startEndIndexFloor: [6, 6],
} as const;

/**
 * EVIDENCE.md §7 — `terrainLookUp` (page-…js:4740-6870).
 * `T` rows × `D` columns sampled along the camera path, then 20 % of every
 * attribute array is re-appended (the duplicate half of the loop pushes
 * `z + cameraPathEnd.z`, i.e. the foreground rows are repeated behind the end
 * of the flight so the far distance is not empty).
 */
export const TERRAIN_PLACEMENT = {
  /** offscreen canvas size — identical to `terrain.png` (100×129 px). */
  lookupCanvas: { x: 100, y: 129 },
  /** `fillStyle="red"` is set before `drawImage` in the original. */
  lookupFillStyle: 'red',
  high: { total: 2000, perRow: 400, seedAmplitude: 5, depthJitterMin: 15, depthJitterMax: 30 },
  boost: { total: 1500, perRow: 100, seedAmplitude: 5, depthJitterMin: 10, depthJitterMax: 20 },
  /** `O += 10*Math.PI/T` per row. */
  rowAngleStepNumerator: 10,
  /** noise coordinates: `noise(.4*x, .4*y, .4*z)`, `0.5 *` for terrain noise. */
  noiseCoordinateScale: 0.4,
  terrainNoiseMultiplier: 0.5,
  /** `I([x,y]) = 43758.5453*sin(dot([x,y],[12.9898,78.233]))%1`. */
  yNoiseHash: { k: 43758.5453, a: 12.9898, b: 78.233 },
  /** `U = y.x + 1.5*B` — the camera-relative lateral spread. */
  lateralSpread: 1.5,
  /** `j = sin((N+.5)*15) + sin((N+.5)*24)` — two-frequency row wave. */
  rowWave: { freqA: 15, freqB: 24, phase: 0.5 },
  /** `W = 2.5*sin(1.5*U)*abs(E)` — valley walls. */
  wall: { amplitude: 2.5, frequency: 1.5 },
  /** `G = -1*pow(E,3)*sign(E)*B` — cubic pull towards the channel centre. */
  centrePull: { exponent: 3 },
  /** `H = clamp(j,0,1)`, `Y = clamp(j+.5,0,1)`. */
  waveClampOffset: 0.5,
  /** `X = -2 + abs(cos(n))*A*(1+.5*Y)`, `A = 4 + cos(O)*random()*2`. */
  height: { base: -2, amplitudeFloor: 4, amplitudeJitter: 2, yWaveMix: 0.5 },
  /** `n -= Math.PI/D` per column (`columnAngleStep = PI / perRow`). */
  columnAngleStepConstant: Math.PI,
  /** `aSpriteScale = .1 + .2*random()`, `aRandomSeed = random()`, `isFirstRow = t<5`. */
  spriteScale: { min: 0.1, spread: 0.2 },
  firstRowLimit: 5,
  /** `isTooDeep = .009*uNegativeSpaceDeepness > terrainNoise && !isRed`. */
  tooDeepFactor: 0.009,
  /** terrain.png colour keys (exact `===` comparisons in the original). */
  colors: {
    white: [255, 255, 255],
    redFloor: [255, 0, 0],
    pool0: [216, 176, 88],
    pool1: [210, 190, 201],
    pool2: [152, 190, 190],
  },
  /** every attribute array gets `arr.concat(arr.slice(0, round(.2*len)))`. */
  duplicateFraction: 0.2,
  seed: 'seed',
} as const;

/** EVIDENCE.md §2 — DPR gate and the boost-performance viewport gate. */
export const PERFORMANCE_CUTOFFS = {
  /** `pixelDensityDimensionCutoff` — page-…js:29395. */
  pixelDensityDimension: 768,
  /** `performanceBoostModeDimensionCutoff` — page-…js:29368. */
  performanceBoostModeDimension: 600,
  /** `uBrightness` under boost — page-…js:18830. */
  brightnessBoost: 1.5,
  brightnessDefault: 1,
} as const;

/**
 * EVIDENCE.md §8, page-…js:12640-13010 (`effects()`).
 * UnrealBloomPass is constructed with `(res, 1.5, .4, .85)` and *then*
 * overwritten by `settings.bloomParams`.
 */
export const POST_PROCESSING = {
  bloomConstructor: { strength: 1.5, radius: 0.4, threshold: 0.85 },
  noisePassTextureResolution: [1280, 720],
  /** `uNoiseDensityThreshold` starts at 0 and is eased to the setting during intro. */
  noiseDensityThresholdInitial: 0,
  noiseDensityEaseRate: 0.4,
  /** `calculateSplitPassIntensity()` — page-…js:12380. */
  splitIntensity: { breakpoint: 768, range: 672, floor: 0.4, slope: 0.6 },
  /** `fbo = new WebGLRenderTarget(w,h,{type: HalfFloatType, colorSpace: SRGB})`. */
  fboType: 'HalfFloatType',
  fboColorSpace: 'SRGBColorSpace',
  glitch: {
    /** manager `this.settings` — page-…js:29740. */
    glitchMultiplier: 0,
    shiftMultiplier: 0,
    darkenFactor: 0.6,
  },
} as const;

/** EVIDENCE.md §2/§4 — the virtual-scroll / camera-progress driver (`page-…js:3560-4180`). */
export const SCROLLER = {
  /** `new Lenis({ el, touchMultiplier: 20 })`. */
  touchMultiplier: 20,
  /** `a = Math.min(15*Math.max(innerWidth,innerHeight), 20000)`. */
  extentFactor: 15,
  extentCap: 20000,
  /** `l += (r - l) * .25` — auto-scroll ramp. */
  autoScrollLerp: 0.25,
  /** per-frame drift `u += -5 * l * min(c,10) / h`. */
  drift: -5,
  driftFrameCap: 10,
  /** `scrollVelocity = (u - prevU) / dt * .2`. */
  velocityScale: 0.2,
  /** `pct = -u * .2 / a`, then `n += (target - n) * .02`. */
  progressScale: 0.2,
  progressSmoothing: 0.02,
  /** `toggleAutoScroll(on)` sets `r = on ? 1 : 0`. */
  autoScrollOn: 1,
  autoScrollOff: 0,
} as const;

/** EVIDENCE.md §2 — pointer, intro, breath and hover constants (`page-…js:20970-24000`). */
export const MOTION = {
  /** `introCameraAngle = 90*(PI/180)`; eased with `min(1, 2*delta)`. */
  introAngleDeg: 90,
  introEaseRate: 2,
  introDoneThresholdDeg: 2,
  introSettledThresholdDeg: 0.1,
  /** `breathContainer.position.y = .02*cos(1.1*t)`, `.z = 1 + .12*cos(1.1*t)`. */
  breathYAmplitude: 0.02,
  breathZAmplitude: 0.12,
  breathFrequency: 1.1,
  breathZOffset: 1,
  /** mouse smoothing `min(1, 5*delta)`; `uMousePosition = (-animX, animY)`. */
  mouseEaseRate: 5,
  /** hover dispersal lerp rates: 10 while hovering, 3 while rolling out. */
  hoverProgressRate: 10,
  rollOutProgressRate: 3,
  exitProgressRate: 2,
  /** `cameraMaxRotationX/Y` per-frame camera tilt (`min(1, .1)` lerp) — both 0 on the live site. */
  cameraRotationEase: 0.1,
} as const;

/** Framer-motion durations, module 6432 (`596-…js`/page chunk `:41630`): WV .25 cE 1 Fu 1.2 HD 3 lD .6 o0 1. */
export const TRANSITION_DURATIONS = {
  pageFadeIn: 0.25,
  pageFadeOut: 1,
  hoverTransition: 1.2,
  rollOutTransition: 3,
  homeExitDelay: 0.6,
  exitTransition: 1,
} as const;

/** Vignette layer, page-…js:7600-8000 (`class E extends Group`). */
export const VIGNETTE = {
  renderOrder: 99,
  planeSize: [2, 2],
  shrinkEase: 0.05,
  /** `setShrinkage(remap(|scrollVelocity|, 0, 10, 0, .5, clamp))`. */
  shrinkInputMax: 10,
  shrinkOutputMax: 0.5,
} as const;

/** EVIDENCE.md §2 — hero text engine (`page-…js:39600-40100`). */
export const HERO_TEXT = {
  /** `--delay` step per character. */
  characterStepSeconds: 0.015,
  /** extra leading offset added to every word's first character. */
  characterLeadSeconds: 0.015,
  /** `--duration`. */
  animationSeconds: 0.25,
  /** `r = .8 / wordCount`. */
  wordSpreadTotal: 0.8,
  /** `c = r * wordIndex * .5`. */
  wordSpreadFactor: 0.5,
  /** visible message index = `floor(count * (2*progress % 1))`. */
  messageCycleFactor: 2,
} as const;

/** Audio manager, page-…js:11700-12300 + zustand store. */
export const AUDIO = {
  maxVolume: 1,
  minVolume: -1,
  initialVolume: 0,
  /** `currentVolume += (target - current) * Math.min(1, 5*delta)`. */
  fadeRate: 5,
  /** low-pass used for `muffleBG(pct)`. */
  lowpassOpenHz: 20000,
  lowpassRangeHz: 19000,
  lowpassQBase: 1,
  lowpassQRange: 4,
  defaultMuted: true,
} as const;

/**
 * EVIDENCE.md §2 — the exact CSS-module class strings present in the live DOM
 * (`evidence/probe-home-2.json`, `page-…js:42297-43289`). Styling lives in
 * `flower-valley.module.css`; these verbatim names are also rendered on the
 * nodes so DOM-level evidence stays comparable.
 */
export const DOM_CLASS_NAMES = {
  canvasContainer: 'js-canvas-container',
  htmlClass: 'homepage',
  flowerValleyWrapper: 'FlowerValley_wrapper__2YGx1',
  flowerValleyCanvas: 'FlowerValley_canvas___rS8E',
  flowerValleyTextContainer: 'FlowerValley_textContainer__PZdtA',
  showreelUI: 'FlowerValley_showreelUI__0cLeS',
  showreelBackButton: 'FlowerValley_showreelBackButton__GwnLv',
  showreelPlayButton: 'FlowerValley_showreelPlayButton___soMY',
  showreelPauseButton: 'FlowerValley_showreelPauseButton__yrpqI',
  showreelMuteButton: 'FlowerValley_showreelMuteButton__nbdnh',
  textCharacter: 'FlowerValleyText_character__4j45e',
  textIsVisible: 'FlowerValleyText_isVisible__8vqou',
  textAnimateIn: 'FlowerValleyText_animate-in__CIGec',
  textAnimateOut: 'FlowerValleyText_animate-out__JgJtR',
  textCta: 'FlowerValleyText_cta__3mukC',
  audioButton: 'AudioControl_audioButton__Gj5AZ',
  loader: 'Loader_loader__iUG7H',
  spinnerWrapper: 'Loader_spinnerWrapper__n5mpi',
  spinner: 'Loader_spinner__lGyv4',
  rotate: 'Loader_rotate__X4lFd',
  circleWrapper: 'Loader_circleWrapper__Z4G9T',
  circle: 'Loader_circle__bdxRu',
  circleAnimation: 'Loader_circle-animation__kG_YY',
} as const;

/** EVIDENCE.md §2 — hero copy, exactly as the live DOM renders it. */
export const HERO_COPY = {
  ariaLabel: '<p>Creative innovation\n<br />for a <i>regenerative</i> future</p>',
  ctaText: 'Explore our work',
  audioUnmuteLabel: 'Unmute audio',
  audioMuteLabel: 'Mute audio',
  posterHeading: ['Creative innovation', 'for a regenerative future'],
} as const;

/** Placement tiers keyed by `QualityTier`. */
export type QualityTierName = 'high' | 'balanced' | 'boost';

export interface QualityTierConfig {
  readonly total: number;
  readonly perRow: number;
  readonly depthJitterMin: number;
  readonly depthJitterMax: number;
  readonly composer: boolean;
  readonly camFar: number;
  readonly seedAmplitude: number;
}

export const QUALITY_TIERS: Readonly<Record<QualityTierName, QualityTierConfig>> = {
  high: {
    total: TERRAIN_PLACEMENT.high.total,
    perRow: TERRAIN_PLACEMENT.high.perRow,
    depthJitterMin: TERRAIN_PLACEMENT.high.depthJitterMin,
    depthJitterMax: TERRAIN_PLACEMENT.high.depthJitterMax,
    composer: true,
    camFar: SCENE_SETTINGS.uCamFar,
    seedAmplitude: TERRAIN_PLACEMENT.high.seedAmplitude,
  },
  balanced: {
    total: TERRAIN_PLACEMENT.boost.total,
    perRow: TERRAIN_PLACEMENT.boost.perRow,
    depthJitterMin: TERRAIN_PLACEMENT.boost.depthJitterMin,
    depthJitterMax: TERRAIN_PLACEMENT.boost.depthJitterMax,
    composer: true,
    camFar: SCENE_SETTINGS.uCamFar,
    seedAmplitude: TERRAIN_PLACEMENT.boost.seedAmplitude,
  },
  boost: {
    total: TERRAIN_PLACEMENT.boost.total,
    perRow: TERRAIN_PLACEMENT.boost.perRow,
    depthJitterMin: TERRAIN_PLACEMENT.boost.depthJitterMin,
    depthJitterMax: TERRAIN_PLACEMENT.boost.depthJitterMax,
    composer: false,
    camFar: CAMERA.farBoostPerformance,
    seedAmplitude: TERRAIN_PLACEMENT.boost.seedAmplitude,
  },
};
