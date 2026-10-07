/**
 * ValleyScene — the real-time Three.js port of the gladeye.com hero.
 *
 * Two classes, mirroring the two classes in the original bundle:
 *
 *  • `FlowerValleyScene` ← `var X = class { constructor(e,t,n,i,o,s,r) … }`
 *    (`evidence/source-assets/js/app/page-4c279de0997d388f.js:12180-25500`):
 *    `this.settings`, the uniform bag, the `scene > cameraContainer >
 *    breathContainer > camera` hierarchy, the flower `Points` cloud, the
 *    vignette layer, the Lenis-driven virtual scroller, the post FX chain and
 *    the per-frame logic (`onFrame`).
 *  • `HomeExperience` ← `var et = class { … }` (`:29330-33500`): the
 *    `WebGLRenderer`, the canvas mount (`js-canvas-container` +
 *    `html.homepage`), resize/pointer listeners, the hover / exit transitions,
 *    the single rAF loop and `destroy()`.
 *
 * Every constant, lerp factor and threshold lives in
 * `src/experience/data/scene-settings.ts`, which cites the bundle offset it was
 * read from. Renaming minified identifiers is the only change made to the
 * algorithms.
 */
import {
  BufferGeometry,
  Float32BufferAttribute,
  Clock,
  Group,
  HalfFloatType,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
  type Texture,
} from 'three';

import {
  ASSETS,
  CAMERA,
  MOTION,
  PERFORMANCE_CUTOFFS,
  POST_PROCESSING,
  QUALITY_TIERS,
  SCENE_SETTINGS,
  SPRITE_SHEET,
  DOM_CLASS_NAMES,
  TRANSITION_DURATIONS,
  VIGNETTE,
  type QualityTierName,
} from './data/scene-settings';
import { CLIP_DURATION, CameraAnimator } from './lib/camera-path';
import { audioStore } from './lib/audio-manager';
import { DustField } from './lib/dust-field';
import { GodRays } from './lib/god-rays';
import { remap } from './lib/math';
import { createPostFX, disposePostFX, resizePostFX, type PostFX } from './lib/post-fx';
import { probeField, type FieldProbeReport } from './lib/field-probe';
import { sortByCameraDepth } from './lib/sort-by-depth';
import { terrainLookUp } from './lib/terrain-lookup';
import { createVirtualScroll, type VirtualScroll } from './lib/virtual-scroll';
import { VignetteLayer } from './lib/vignette-layer';
import { shaderPair } from './glsl';
import type {
  AssetIssue,
  DegradeReason,
  Diagnostics,
  FlowerUniforms,
  QualityTier,
  ShaderIssue,
} from './types';

// `a.dpR.prototype.crossOrigin = ""` — page-…js:1060
if (typeof TextureLoader !== 'undefined') TextureLoader.prototype.crossOrigin = '';

/** live runtimes, reported as `diagnostics.runtimes` */
let activeRuntimes = 0;

// Engineering failure bound for the entire asset load, not a source-site value.
const ASSET_LOAD_DEADLINE_MS = 30_000;

class AssetLoadTimeout extends Error {
  readonly issue: AssetIssue;

  constructor(url: string, kind: AssetIssue['kind'], stage: string) {
    super(`asset loading timeout after ${ASSET_LOAD_DEADLINE_MS}ms during ${stage} (${assetUrl(url)})`);
    this.name = 'AssetLoadTimeout';
    this.issue = { url: assetUrl(url), kind, message: this.message };
  }
}

export interface ValleyCallbacks {
  onProgress?: (loaded: number, total: number) => void;
  onReady?: () => void;
  onIntroDone?: () => void;
  onScrollProgress?: (pct: number) => void;
}

export interface ValleyMountOptions extends ValleyCallbacks {
  container: HTMLElement;
  quality?: QualityTier;
  /**
   * Dust + god-rays exist verbatim in the bundle but the shipped `buildScene()`
   * no longer instantiates them, so the clone leaves them off by default.
   */
  enableDormantLayers?: boolean;
}

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'failed';

/* ------------------------------------------------------------------ *
 * WebGL capability probe (memoised)
 * ------------------------------------------------------------------ */

export interface WebglSupport {
  supported: boolean;
  webgl2: boolean;
  rendererName: string;
}

let cachedSupport: WebglSupport | null = null;

export function probeWebgl(): WebglSupport {
  if (cachedSupport) return cachedSupport;
  if (typeof window === 'undefined') {
    return { supported: false, webgl2: false, rendererName: '' };
  }
  try {
    const canvas = document.createElement('canvas');
    const gl2 = canvas.getContext('webgl2');
    if (gl2) {
      const dbg = gl2.getExtension('WEBGL_debug_renderer_info');
      const name = dbg ? String(gl2.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : 'webgl2';
      cachedSupport = { supported: true, webgl2: true, rendererName: name };
      return cachedSupport;
    }
    const gl1 = canvas.getContext('webgl');
    if (gl1) {
      const ext = gl1.getExtension('WEBGL_debug_renderer_info');
      const name = ext ? String(gl1.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'webgl1';
      cachedSupport = { supported: true, webgl2: false, rendererName: name };
      return cachedSupport;
    }
  } catch {
    /* fall through */
  }
  cachedSupport = { supported: false, webgl2: false, rendererName: '' };
  return cachedSupport;
}

/** Captures three's `WebGLProgram` console output while `run()` compiles. */
function captureShaderLog<T>(run: () => T): { result: T; issues: ShaderIssue[] } {
  const issues: ShaderIssue[] = [];
  const originalError = console.error;
  const originalWarn = console.warn;

  const sink =
    (stage: ShaderIssue['stage']) =>
    (message?: unknown, ...rest: unknown[]): void => {
      const text = [message, ...rest]
        .map((part) => (typeof part === 'string' ? part : ''))
        .join(' ')
        .trim();
      if (/shader|program|glsl|link|compile/i.test(text)) {
        issues.push({ name: 'WebGLProgram', stage, message: text.slice(0, 4000) });
      }
      if (stage === 'fragment') originalError(message, ...rest);
      else originalWarn(message, ...rest);
    };

  try {
    console.error = sink('program');
    console.warn = sink('program');
    return { result: run(), issues };
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
  }
}

/** Release every owned resource, then surface the first cleanup error. */
function releaseAll(releases: Array<() => void>): void {
  let failed = false;
  let firstError: unknown;
  for (const release of releases) {
    try {
      release();
    } catch (error) {
      if (!failed) firstError = error;
      failed = true;
    }
  }
  if (failed) throw firstError;
}

/* ------------------------------------------------------------------ *
 * FlowerValleyScene
 * ------------------------------------------------------------------ */

export class FlowerValleyScene {
  /** mutable copy of `this.settings` (the GUI mutated it in the original) */
  readonly settings = { ...SCENE_SETTINGS, bloomParams: { ...SCENE_SETTINGS.bloomParams } };

  readonly camera: PerspectiveCamera;
  readonly scene = new Scene();
  readonly cameraContainer = new Group();
  readonly breathContainer = new Group();

  readonly mouse = { x: 0, y: 0 };
  readonly animMouse = new Vector2(0, 0);
  readonly uniforms: FlowerUniforms;

  clock = new Clock();
  cameraAnim: CameraAnimator | null = null;
  scroller: VirtualScroll | null = null;

  points: Points | null = null;
  vignette: VignetteLayer | null = null;
  dust: DustField | null = null;
  godRays: GodRays | null = null;
  composer: PostFX | null = null;

  maxPixelRatio = 1;
  composerPixelRatio = 1;
  pixelRatio = 1;
  useBoostPerformance: boolean;

  buttonHover = false;
  buttonHoverProgress = 0;
  buttonHoverProgressTarget = 0;
  exit = false;
  extra = 0;

  isAnimatedIn = false;
  hasStartedAnimatingIn = false;
  introDoneFired = false;
  introCameraAngle = (MOTION.introAngleDeg * Math.PI) / 180;
  cameraAnimationProgress = 0;
  cameraFov: number | null = null;

  /** QA overrides — replace the scroller / hover inputs when set. */
  timeOverride: number | null = null;
  progressOverride: number | null = null;
  dispersalOverride: number | null = null;

  placementMs = 0;
  pointCount = 0;
  bounds = { minX: 0, maxX: 0, minZ: 0, maxZ: 0, leafRatio: 0, discardRatio: 0 };
  qualityTier: QualityTierName = 'high';
  enableDormantLayers = false;
  assetFailures: AssetIssue[] = [];
  shaderIssues: ShaderIssue[] = [];

  private readonly fbo: WebGLRenderTarget;
  private readonly container: HTMLElement;
  private readonly callbacks: ValleyCallbacks;
  private renderer: WebGLRenderer | null = null;
  private resizeTimeout: ReturnType<typeof setTimeout> | undefined;
  private textureCache: Record<string, Texture> = {};
  private readonly pendingTextures = new Set<Texture>();
  private cancelAssetLoad: (() => void) | null = null;
  private disposed = false;
  private gltfCamPosition = new Vector3();
  private disposedGeometry: BufferGeometry | null = null;
  private disposedMaterial: ShaderMaterial | null = null;
  private terrainImage: HTMLImageElement | null = null;

  constructor(
    container: HTMLElement,
    useBoostPerformance: boolean,
    cameraMaxRotationX: number,
    cameraMaxRotationY: number,
    callbacks: ValleyCallbacks,
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.useBoostPerformance = useBoostPerformance;
    // `X(e,t,n,i,o,s,r)` → `settings.cameraMaxRotationX = s`, `…Y = r`
    this.settings.cameraMaxRotationX = cameraMaxRotationX;
    this.settings.cameraMaxRotationY = cameraMaxRotationY;

    this.camera = new PerspectiveCamera(
      CAMERA.fov,
      window.innerWidth / window.innerHeight,
      CAMERA.near,
      this.settings.uCamFar,
    );

    // `breathContainer.add(camera); cameraContainer.add(breathContainer); scene.add(cameraContainer)`
    this.breathContainer.add(this.camera);
    this.cameraContainer.add(this.breathContainer);
    this.scene.add(this.cameraContainer);

    this.maxPixelRatio = this.computeMaxPixelRatio();
    this.composerPixelRatio = Math.min(this.maxPixelRatio, window.devicePixelRatio);
    this.pixelRatio = Math.min(this.maxPixelRatio, window.devicePixelRatio);

    this.fbo = new WebGLRenderTarget(window.innerWidth, window.innerHeight, {
      type: HalfFloatType,
      colorSpace: SRGBColorSpace,
    });

    try {
      this.uniforms = this.buildUniforms();
    } catch (error) {
      // The constructor has not returned, so its caller cannot own this FBO yet.
      try { this.fbo.dispose(); } catch { /* Preserve the initialization error. */ }
      throw error;
    }
  }

  /* ---------------- uniform bag — page-…js:13100-15520, verbatim --------------- */

  private buildUniforms(): FlowerUniforms {
    const { innerWidth, innerHeight } = window;
    const s = this.settings;
    return {
      uTime: { value: 0 },
      uTotalZ: { value: 0 },
      uContainerPos: { value: new Vector3(0, 0, 0) },
      uTerrainOffsetX: { value: s.uTerrainOffsetX },
      uTerrainOffsetY: { value: s.uTerrainOffsetY },
      uLeavesBaseScale: { value: s.uLeavesBaseScale },
      uFlowerBaseScale: { value: s.uFlowerBaseScale },
      uFlowerBloomDistance: { value: s.uFlowerBloomDistance },
      uLeafGrowDistance: { value: s.uLeafGrowDistance },
      uNegativeSpaceDeepness: { value: s.uNegativeSpaceDeepness },
      uRepulsionStrength: { value: s.uRepulsionStrength },
      uBrightnessOnTouch: { value: s.uBrightnessOnTouch },
      uCamNear: { value: s.uCamNear },
      uCamFar: { value: s.uCamFar },
      uLuminosity: { value: null },
      uCanvasTexture: { value: null },
      uSpriteSheetPool: { value: null },
      uSpriteSheetPool2: { value: null },
      uSpriteSheetMix: { value: s.uSpriteSheetMix },
      uSigmoidSteepness: { value: s.uSigmoidSteepness },
      uInteractionPositionOffset: { value: s.uInteractionPositionOffset },
      uStartEndIndexPool_0: { value: new Vector2(...SPRITE_SHEET.startEndIndexPool_0) },
      uStartEndIndexPool_1: { value: new Vector2(...SPRITE_SHEET.startEndIndexPool_1) },
      uStartEndIndexPool_2: { value: new Vector2(...SPRITE_SHEET.startEndIndexPool_2) },
      uStartEndIndexLeaves: { value: new Vector2(...SPRITE_SHEET.startEndIndexLeaves) },
      uStartEndIndexFloor: { value: new Vector2(...SPRITE_SHEET.startEndIndexFloor) },
      uPoolSheetSize: { value: new Vector2(...SPRITE_SHEET.poolSheetSize) },
      uAmountOfSprites: { value: new Vector2(...SPRITE_SHEET.amountOfSprites) },
      res: { value: new Vector2(innerWidth, innerHeight) },
      uComposerPixelRatio: { value: this.composerPixelRatio },
      uBrightness: { value: PERFORMANCE_CUTOFFS.brightnessDefault },
      uDispersalProgress: { value: 1 },
      uCamFov: { value: CAMERA.fov },
      uCamFovBase: { value: CAMERA.fov },
      uDispersalAmountMultiplier: { value: s.dispersalAmountMultiplier },
      uMaxDispersedPosX: { value: s.uMaxDispersedPosX },
      uMaxDispersedPosY: { value: s.uMaxDispersedPosY },
      uDispersalRandomnessWeight: { value: s.dispersalRandomnessWeight },
      uDispersalIsFlowerWeight: { value: s.dispersalIsFlowerWeight },
      uDispersalPositionYWeight: { value: s.dispersalPositionYWeight },
      uMousePosition: { value: new Vector2(0, 0) },
      uResolution: { value: new Vector2(innerWidth, innerHeight) },
    };
  }

  attachRenderer(renderer: WebGLRenderer): void {
    this.renderer = renderer;
    this.effects();
    this.updateSize();
  }

  /* ---------------- effects — page-…js:12640-13060 --------------- */

  effects(): void {
    if (!this.renderer) return;
    if (this.useBoostPerformance) {
      if (this.composer) {
        disposePostFX(this.composer);
        this.composer = null;
      }
      return;
    }
    if (this.composer) return;
    this.composer = createPostFX(this.renderer, this.scene, this.camera);
  }

  /* ---------------- assets — page-…js:17440-18000 (`loadAssets`) --------------- */

  async loadAssets(): Promise<void> {
    if (this.disposed) return;
    const loader = new TextureLoader();
    const urls = ASSETS.textureOrder;
    const total = urls.length + 1;
    const pending = new Set<Texture>();
    const pendingUrls = new Set<string>(urls);
    let terrainRequested = false;
    let abandoned = false;
    let settled = false;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    let rejectLoad!: (error: Error) => void;
    const interruption = new Promise<never>((_resolve, reject) => { rejectLoad = reject; });
    const clearDeadline = (): void => {
      if (deadline !== undefined) clearTimeout(deadline);
      deadline = undefined;
    };
    const cancel = (): void => {
      if (settled || abandoned) return;
      abandoned = true;
      clearDeadline();
      rejectLoad(new Error('asset loading cancelled'));
    };
    this.cancelAssetLoad = cancel;
    deadline = setTimeout(() => {
      if (settled || abandoned || this.disposed) return;
      abandoned = true;
      rejectLoad(new AssetLoadTimeout(
        terrainRequested ? ASSETS.terrain : pendingUrls.values().next().value ?? urls[0],
        terrainRequested ? 'image-data' : 'texture',
        terrainRequested ? 'terrain/scene preparation' : pendingUrls.size > 0 ? 'texture request' : 'texture batch completion',
      ));
      clearDeadline();
      // Close ownership synchronously before any queued/late result can run.
      try { this.dispose(); } catch { /* Preserve the timeout diagnostic. */ }
    }, ASSET_LOAD_DEADLINE_MS);

    const load = async (): Promise<void> => {
      this.callbacks.onProgress?.(0, total);
      if (this.disposed) return;
      const results = await Promise.all(
        urls.map(
          (url) =>
            new Promise<{ url: string; texture: Texture | null }>((resolve) => {
              loader.load(
                assetUrl(url),
                (texture) => {
                  pendingUrls.delete(url);
                  if (this.disposed || abandoned) {
                    texture.dispose();
                    resolve({ url, texture: null });
                    return;
                  }
                  // Own successes immediately, even while another request is pending.
                  pending.add(texture);
                  this.pendingTextures.add(texture);
                  resolve({ url, texture });
                },
                undefined,
                () => {
                  pendingUrls.delete(url);
                  resolve({ url, texture: null });
                },
              );
            }),
        ),
      );
      if (this.disposed) return;

      let loaded = 0;
      for (const item of results) {
        loaded += 1;
        this.callbacks.onProgress?.(loaded, total);
        if (this.disposed) return;
        if (item.texture) {
          pending.delete(item.texture);
          this.pendingTextures.delete(item.texture);
          // `e.colorSpace = SRGBColorSpace` × 7 (EVIDENCE.md §5)
          item.texture.colorSpace = SRGBColorSpace;
          this.textureCache[item.url] = item.texture;
        } else {
          this.assetFailures.push({ url: assetUrl(item.url), kind: 'texture', message: 'load failed' });
        }
      }

      const pool = this.textureCache[ASSETS.spritePoolSummer];
      const pool2 = this.textureCache[ASSETS.spritePoolWinter];
      if (!pool || !pool2) throw new Error('flower sprite sheets failed to load');
      this.uniforms.uSpriteSheetPool.value = pool;
      this.uniforms.uSpriteSheetPool2.value = pool2;

      // `this.terrainMapImage = new Image(); … .onload = async () => { await buildScene(); startRender(); }`
      terrainRequested = true;
      const terrainImage = await loadImage(assetUrl(ASSETS.terrain));
      if (this.disposed) return;
      this.terrainImage = terrainImage;
      loaded += 1;
      this.callbacks.onProgress?.(loaded, total);
      if (this.disposed) return;

      this.cameraAnim = new CameraAnimator(this.cameraContainer);
      await this.buildScene(terrainImage);
      if (this.disposed) return;
      settled = true;
      clearDeadline();
      this.callbacks.onReady?.();
    };

    try {
      await Promise.race([load(), interruption]);
    } catch (error) {
      abandoned = true;
      pending.forEach((texture) => {
        if (this.pendingTextures.delete(texture)) texture.dispose();
      });
      throw error;
    } finally {
      settled = true;
      clearDeadline();
      if (this.cancelAssetLoad === cancel) this.cancelAssetLoad = null;
    }
  }

  /** Re-runs `terrainLookUp` + geometry at the current tier (used by `setQuality`). */
  async reloadPlacement(): Promise<void> {
    if (this.disposed || !this.terrainImage || !this.cameraAnim) return;
    this.cameraAnim = new CameraAnimator(this.cameraContainer);
    await this.buildScene(this.terrainImage);
  }

  /* ---------------- buildScene — page-…js:19860-20950 --------------- */

  async buildScene(terrainImage: HTMLImageElement): Promise<void> {
    if (this.disposed) return;
    const tier = QUALITY_TIERS[this.qualityTier];
    if (!this.cameraAnim) throw new Error('camera path not initialised');

    const startedAt = performance.now();
    const placement = terrainLookUp({
      cameraAnim: this.cameraAnim,
      terrainImage,
      uNegativeSpaceDeepness: this.settings.uNegativeSpaceDeepness,
      total: tier.total,
      perRow: tier.perRow,
      seedAmplitude: tier.seedAmplitude,
      depthJitterMin: tier.depthJitterMin,
      depthJitterMax: tier.depthJitterMax,
    });
    this.placementMs = performance.now() - startedAt;

    const geometry = new BufferGeometry();
    geometry.setAttribute('aValleySide', new Float32BufferAttribute(placement.aValleySides, 1));
    geometry.setAttribute('aIsFloorDiscard', new Float32BufferAttribute(placement.aIsFloorDiscards, 1));
    geometry.setAttribute('aIsFirstRow', new Float32BufferAttribute(placement.isFirstRow, 1));
    geometry.setAttribute('aNoiseCoordinate', new Float32BufferAttribute(placement.noiseCoordinates, 3));
    geometry.setAttribute('aSpriteScale', new Float32BufferAttribute(placement.aSpriteScales, 1));
    geometry.setAttribute('position', new Float32BufferAttribute(placement.positions, 3));
    geometry.setAttribute('aColorCoordinate', new Float32BufferAttribute(placement.aColorCoordinates, 2));
    geometry.setAttribute('aRandomSeed', new Float32BufferAttribute(placement.random, 1));
    geometry.setAttribute('aPoolId', new Float32BufferAttribute(placement.aPoolId, 1));
    geometry.setAttribute('aIsFloorPool', new Float32BufferAttribute(placement.aIsFloorPool, 1));
    geometry.setAttribute('aTerrainNoise', new Float32BufferAttribute(placement.aTerrainNoise, 1));
    geometry.setAttribute('aYNoise', new Float32BufferAttribute(placement.aYNoise, 1));
    geometry.setAttribute('aFlowerGrowNoise', new Float32BufferAttribute(placement.aFlowerGrowNoise, 1));

    const pair = shaderPair('flower');
    const material = new ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: pair.vertexShader,
      fragmentShader: pair.fragmentShader,
      transparent: true,
      depthTest: false,
    });

    const points = new Points(geometry, material);
    if (this.points) {
      this.disposedGeometry?.dispose();
      this.disposedMaterial?.dispose();
      this.scene.remove(this.points);
    }
    this.disposedGeometry = geometry;
    this.disposedMaterial = material;
    this.points = points;
    this.scene.add(points);
    this.pointCount = placement.positions.length / 3;

    const vignetteTexture = this.textureCache[ASSETS.vignette];
    if (vignetteTexture) {
      this.vignette = new VignetteLayer({
        texture: vignetteTexture,
        renderOrder: VIGNETTE.renderOrder,
      });
      this.scene.add(this.vignette);
    }

    if (this.enableDormantLayers) {
      const dustTexture = this.textureCache[ASSETS.dustParticle];
      if (dustTexture) {
        this.dust = new DustField({ texture: dustTexture });
        this.scene.add(this.dust.points);
      }
      const ray1 = this.textureCache[ASSETS.ray1];
      const ray2 = this.textureCache[ASSETS.ray2];
      const ray3 = this.textureCache[ASSETS.ray3];
      if (ray1 && ray2 && ray3) {
        this.godRays = new GodRays({ ray1, ray2, ray3 });
        this.scene.add(this.godRays.mesh);
      }
    }

    // placement report: the channel must span the camera flight and keep a
    // leaf/flower split, otherwise the cloud is uniform noise (a clone bug).
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    let leaves = 0;
    let discarded = 0;
    for (let i = 0; i < placement.aTerrainNoise.length; i++) {
      if (this.settings.uNegativeSpaceDeepness > placement.aTerrainNoise[i]) leaves += 1;
      if (placement.aIsFloorDiscards[i] > 0.5) discarded += 1;
    }
    for (let i = 0; i < placement.positions.length; i += 3) {
      const x = placement.positions[i];
      const z = placement.positions[i + 2];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    const attributeCount = placement.aTerrainNoise.length || 1;
    this.bounds = {
      minX,
      maxX,
      minZ,
      maxZ,
      leafRatio: leaves / attributeCount,
      discardRatio: discarded / attributeCount,
    };

    // `N(this.points, this.camera)` — painter-order index so the additive
    // sprites blend far → near with depth testing disabled.
    this.camera.updateMatrixWorld(true);
    this.cameraContainer.updateMatrixWorld(true);
    points.updateMatrixWorld(true);
    sortByCameraDepth(points, this.camera);
  }

  /** Compiles every program so shader errors surface before the first frame. */
  validatePrograms(): ShaderIssue[] {
    if (!this.renderer) return [];
    const { issues } = captureShaderLog(() => {
      this.renderer?.compile(this.scene, this.camera);
    });
    return issues;
  }

  /* ---------------- intro + frame — page-…js:20950-24300 --------------- */

  animateIn(): void {
    this.breathContainer.rotation.x = this.introCameraAngle;
    this.camera.rotation.x = 0;
    this.camera.rotation.y = 0;
    this.clock.getDelta();
    this.scroller?.start();
    this.hasStartedAnimatingIn = true;
  }

  animateCameraIn(): void {
    this.breathContainer.rotation.x = this.introCameraAngle;
  }

  onFrameAlwaysRun(): void {
    const targetY = -(this.settings.cameraMaxRotationX * (Math.PI / 180) * this.mouse.x);
    const targetX = -(this.settings.cameraMaxRotationY * (Math.PI / 180) * this.mouse.y);
    this.camera.rotation.y += (targetY - this.camera.rotation.y) * MOTION.cameraRotationEase;
    this.camera.rotation.x += (targetX - this.camera.rotation.x) * MOTION.cameraRotationEase;
  }

  onFrame(): void {
    if (!this.hasStartedAnimatingIn) this.animateIn();

    const delta = this.clock.getDelta();
    const elapsed = this.clock.getElapsedTime();

    if (!this.isAnimatedIn) {
      this.introCameraAngle +=
        (0 - this.introCameraAngle) * Math.min(1, MOTION.introEaseRate * delta);
      this.animateCameraIn();
      if (this.introCameraAngle <= (MOTION.introDoneThresholdDeg * Math.PI) / 180) {
        if (!this.introDoneFired) {
          this.introDoneFired = true;
          this.callbacks.onIntroDone?.();
        }
      }
      if (this.introCameraAngle <= (MOTION.introSettledThresholdDeg * Math.PI) / 180) {
        this.introCameraAngle = 0;
        this.isAnimatedIn = true;
      }
      if (this.composer) {
        const ease = Math.min(1, POST_PROCESSING.noiseDensityEaseRate * delta);
        const current = this.composer.noiseUniforms.uNoiseDensityThreshold.value;
        this.composer.noiseUniforms.uNoiseDensityThreshold.value =
          current + (this.settings.uNoiseDensityThreshold - current) * ease;
      }
    }

    // breathContainer sway
    this.breathContainer.position.y =
      MOTION.breathYAmplitude * Math.cos(MOTION.breathFrequency * elapsed);
    this.breathContainer.position.z =
      MOTION.breathZOffset + MOTION.breathZAmplitude * Math.cos(MOTION.breathFrequency * elapsed);

    // hover dispersal
    let lerpFrames: number = MOTION.hoverProgressRate;
    if (this.buttonHover) {
      this.buttonHoverProgressTarget = 1;
    } else {
      lerpFrames = MOTION.rollOutProgressRate;
      this.buttonHoverProgressTarget = 0;
    }
    if (this.exit) {
      this.buttonHoverProgressTarget = 1;
      const ease = Math.min(1, MOTION.exitProgressRate * delta);
      this.extra += (1 - this.extra) * ease;
    }

    const progressEase = Math.min(1, delta * lerpFrames);
    this.buttonHoverProgress +=
      (this.buttonHoverProgressTarget - this.buttonHoverProgress) * progressEase;

    const dispersal = this.dispersalOverride ?? this.buttonHoverProgress;
    this.uniforms.uDispersalProgress.value = dispersal;

    const fovScale = 1 + dispersal * this.settings.fovMultiplier;
    if (this.cameraFov !== null) {
      this.camera.fov = this.cameraFov * fovScale - CAMERA.exitFovReduction * this.extra;
    }
    this.uniforms.uCamFov.value = this.camera.fov;
    this.camera.updateProjectionMatrix();

    const mouseEase = Math.min(1, MOTION.mouseEaseRate * delta);
    this.animMouse.x += (this.mouse.x - this.animMouse.x) * mouseEase;
    this.animMouse.y += (this.mouse.y - this.animMouse.y) * mouseEase;
    this.uniforms.uMousePosition.value = new Vector2(-1 * this.animMouse.x, this.animMouse.y);

    if (this.composer) {
      this.composer.noiseUniforms.time.value = 0.001 * window.performance.now();
    }

    audioStore.updateVolume(delta);
    if (dispersal > 0) audioStore.muffleBG(dispersal);

    if (!this.scroller || !this.cameraAnim) return;

    let progress: number;
    let scrollVelocity = 0;
    if (this.timeOverride !== null) {
      progress = this.timeOverride / CLIP_DURATION;
      this.cameraAnim.update(0.9999, false);
    } else if (this.progressOverride !== null) {
      progress = this.progressOverride;
    } else {
      const state = this.scroller.getScrollPct();
      progress = state.normalized;
      scrollVelocity = state.scrollVelocity;
    }

    this.cameraAnimationProgress = progress;
    // `.5` — the live frame loop pins the summer/winter mix every frame
    // (`page-…js:23930`), the `settings.uSpriteSheetMix: 0` default is inert.
    this.uniforms.uSpriteSheetMix.value = 0.5;

    this.gltfCamPosition = this.cameraAnim.update(
      progress,
      true,
      this.settings.cameraEase,
      this.settings.cameraMaxDistanceDiff,
    );
    this.uniforms.uContainerPos.value = this.gltfCamPosition;
    this.uniforms.uTime.value = elapsed;
    this.callbacks.onScrollProgress?.(progress);

    if (this.vignette) {
      const shrinkage = remap(
        Math.abs(scrollVelocity),
        0,
        VIGNETTE.shrinkInputMax,
        0,
        VIGNETTE.shrinkOutputMax,
        true,
      );
      this.vignette.setShrinkage(shrinkage);
      this.vignette.update();
    }

    this.dust?.update(elapsed, this.gltfCamPosition, dispersal);
    this.godRays?.update(elapsed, progress * 3);
  }

  onMouseMove = (event: PointerEvent): void => {
    const x = event.pageX / window.innerWidth;
    const y = (event.pageY - window.scrollY) / window.innerHeight;
    this.mouse.x = remap(x, 0, 1, -1, 1);
    this.mouse.y = remap(y, 0, 1, -1, 1);
  };

  /* ---------------- sizing — page-…js:18260-18900 --------------- */

  private computeMaxPixelRatio(): number {
    return window.innerWidth < PERFORMANCE_CUTOFFS.pixelDensityDimension ||
      window.innerHeight < PERFORMANCE_CUTOFFS.pixelDensityDimension
      ? 2
      : 1;
  }

  updateSize(): void {
    const { innerWidth, innerHeight } = window;
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.cameraFov = this.camera.fov;
    this.uniforms.uCamFovBase.value = this.cameraFov;

    this.effects();

    this.maxPixelRatio = this.computeMaxPixelRatio();
    this.composerPixelRatio = Math.min(this.maxPixelRatio, window.devicePixelRatio);
    this.pixelRatio = Math.min(this.maxPixelRatio, window.devicePixelRatio);
    this.uniforms.uComposerPixelRatio.value = this.composerPixelRatio;

    this.uniforms.res.value.set(innerWidth, innerHeight);
    this.uniforms.uResolution.value.set(innerWidth, innerHeight);
    this.uniforms.uBrightness.value = this.useBoostPerformance
      ? PERFORMANCE_CUTOFFS.brightnessBoost
      : PERFORMANCE_CUTOFFS.brightnessDefault;

    this.settings.uCamFar = this.useBoostPerformance
      ? CAMERA.farBoostPerformance
      : SCENE_SETTINGS.uCamFar;
    this.uniforms.uCamFar.value = this.settings.uCamFar;
    this.camera.far = this.settings.uCamFar;
    this.camera.updateProjectionMatrix();

    if (this.composer) {
      resizePostFX(this.composer, innerWidth, innerHeight, this.composerPixelRatio);
    }
    this.fbo.setSize(innerWidth, innerHeight);
  }

  resize = (): void => {
    if (this.disposed) return;
    this.updateSize();
    if (this.resizeTimeout !== undefined) clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(() => {
      if (!this.disposed) this.updateSize();
    }, 50);
  };

  /* ---------------- render — page-…js:24300-24600 --------------- */

  render(toTexture = false): void {
    if (!this.renderer) return;
    if (toTexture) {
      if (this.composer) {
        this.composer.composer.renderToScreen = false;
        this.composer.composer.render();
      } else {
        this.renderer.setRenderTarget(this.fbo);
        this.renderer.clear();
        this.renderer.render(this.scene, this.camera);
      }
      return;
    }
    if (this.composer) {
      this.composer.composer.renderToScreen = true;
      this.composer.composer.render();
    } else {
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.scene, this.camera);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const cancelAssetLoad = this.cancelAssetLoad;
    this.cancelAssetLoad = null;
    cancelAssetLoad?.();
    // Detach ownership before releasing: a throwing cleanup must not prevent
    // another resource from being released or let a repeated dispose retry it.
    const resizeTimeout = this.resizeTimeout;
    const scroller = this.scroller;
    const points = this.points;
    const vignette = this.vignette;
    const dust = this.dust;
    const godRays = this.godRays;
    const cameraAnim = this.cameraAnim;
    const composer = this.composer;
    const textures = [...Object.values(this.textureCache), ...Array.from(this.pendingTextures)];
    this.resizeTimeout = undefined;
    this.scroller = null;
    this.points = null;
    this.disposedGeometry = null;
    this.disposedMaterial = null;
    this.vignette = null;
    this.dust = null;
    this.godRays = null;
    this.cameraAnim = null;
    this.composer = null;
    this.textureCache = {};
    this.pendingTextures.clear();
    this.terrainImage = null;
    this.renderer = null;

    releaseAll([
      () => { if (resizeTimeout !== undefined) clearTimeout(resizeTimeout); },
      () => scroller?.destroy(),
      () => points?.geometry.dispose(),
      () => { if (points) (points.material as ShaderMaterial).dispose(); },
      () => { if (points) this.scene.remove(points); },
      () => vignette?.dispose(),
      () => dust?.dispose(),
      () => godRays?.dispose(),
      () => cameraAnim?.destroy(),
      () => { if (composer) disposePostFX(composer); },
      () => this.fbo.dispose(),
      ...textures.map((texture) => () => texture.dispose()),
    ]);
  }
}

/* ------------------------------------------------------------------ *
 * HomeExperience — renderer + lifecycle owner
 * ------------------------------------------------------------------ */

export class HomeExperience {
  readonly renderer: WebGLRenderer;
  readonly valleyScene: FlowerValleyScene;

  useBoostPerformance: boolean;
  readonly performanceBoostModeDimensionCutoff =
    PERFORMANCE_CUTOFFS.performanceBoostModeDimension;

  exitTransitionProgress = 0;
  valleyReady = false;
  status: LoadStatus = 'idle';
  progress = { loaded: 0, total: 0 };
  failures: AssetIssue[] = [];
  degradeReasons: DegradeReason[] = [];
  bootMs = 0;
  fps = 0;

  readonly managerSettings = {
    glitchMultiplier: POST_PROCESSING.glitch.glitchMultiplier,
    shiftMultiplier: POST_PROCESSING.glitch.shiftMultiplier,
    darkenFactor: POST_PROCESSING.glitch.darkenFactor,
    hoverTransitionDuration: TRANSITION_DURATIONS.hoverTransition,
    rollOutTransitionDuration: TRANSITION_DURATIONS.rollOutTransition,
    exitTransitionDuration: TRANSITION_DURATIONS.exitTransition,
    homeExitDelay: TRANSITION_DURATIONS.homeExitDelay,
    /** the manager's own values, which override `SCENE_SETTINGS`'s zeros at runtime */
    cameraMaxRotationX: 1,
    cameraMaxRotationY: 1,
  };

  private readonly clock = new Clock();
  private readonly container: HTMLElement;
  private readonly callbacks: ValleyCallbacks;
  private readonly canvas: HTMLCanvasElement;
  private rafID = 0;
  private destroyed = false;
  private resizeTimeout: ReturnType<typeof setTimeout> | undefined;
  private exitTweenRaf = 0;
  private readonly frameTimes: number[] = [];

  constructor(options: ValleyMountOptions) {
    const bootStart = performance.now();
    this.container = options.container;
    this.callbacks = options;

    this.useBoostPerformance =
      window.innerWidth < this.performanceBoostModeDimensionCutoff ||
      window.innerHeight < this.performanceBoostModeDimensionCutoff;

    this.renderer = new WebGLRenderer({ antialias: !this.useBoostPerformance });
    const rollback: Array<() => void> = [() => this.renderer.dispose()];
    try {
      this.canvas = this.renderer.domElement;
      const canvas = this.canvas;
      rollback.push(() => { if (canvas.parentElement) canvas.parentElement.removeChild(canvas); });

      this.valleyScene = new FlowerValleyScene(
        options.container,
        this.useBoostPerformance,
        this.managerSettings.cameraMaxRotationX,
        this.managerSettings.cameraMaxRotationY,
        {
          ...options,
          onProgress: (loaded, total) => {
            if (this.destroyed) return;
            this.progress = { loaded, total };
            options.onProgress?.(loaded, total);
          },
          onReady: () => this.markValleyReady(),
        },
      );
      rollback.push(() => this.valleyScene.dispose());
      this.valleyScene.qualityTier = options.quality ?? (this.useBoostPerformance ? 'boost' : 'high');
      this.valleyScene.enableDormantLayers = options.enableDormantLayers === true;

      this.renderer.outputColorSpace = SRGBColorSpace;
      this.valleyScene.attachRenderer(this.renderer);

      // `document.getElementsByClassName("js-canvas-container")[0].prepend(renderer.domElement)`
      // — scoped to *our* wrapper instead of a global query, so a parallel shell
      //   can never steal the canvas.
      const mountNode =
        this.container.querySelector(`.${DOM_CLASS_NAMES.canvasContainer}`) ?? this.container;
      mountNode.prepend(this.canvas);
      const hadHomepageClass = document.documentElement.classList.contains(DOM_CLASS_NAMES.htmlClass);
      rollback.push(() => {
        if (!hadHomepageClass) document.documentElement.classList.remove(DOM_CLASS_NAMES.htmlClass);
      });
      document.documentElement.classList.add(DOM_CLASS_NAMES.htmlClass);

      activeRuntimes += 1;
      rollback.push(() => { activeRuntimes = Math.max(0, activeRuntimes - 1); });

      this.updateSize();
      rollback.push(() => window.removeEventListener('resize', this.resize));
      window.addEventListener('resize', this.resize);
      rollback.push(() => window.removeEventListener('pointermove', this.onMouseMove));
      window.addEventListener('pointermove', this.onMouseMove);

      this.valleyScene.scroller = createVirtualScroll(options.container);
      this.valleyScene.clock.getDelta();

      void this.load();
      this.bootMs = performance.now() - bootStart;
    } catch (error) {
      this.destroyed = true;
      try { releaseAll(rollback.reverse()); } catch { /* Preserve the initialization error. */ }
      throw error;
    }
  }

  private async load(): Promise<void> {
    if (this.destroyed) return;
    this.status = 'loading';
    try {
      await this.valleyScene.loadAssets();
      if (this.destroyed) return;
      this.valleyScene.shaderIssues = this.valleyScene.validatePrograms();
      if (this.valleyScene.shaderIssues.length > 0) {
        this.degradeReasons.push('shader-compile-failed');
      }
      this.status = 'ready';
    } catch (error) {
      if (this.destroyed) return;
      this.status = 'failed';
      this.failures.push(error instanceof AssetLoadTimeout ? error.issue : {
        url: assetUrl(ASSETS.terrain),
        kind: 'image-data',
        message: error instanceof Error ? error.message : 'asset load failed',
      });
      this.degradeReasons.push('asset-load-failed');
      if (error instanceof AssetLoadTimeout) {
        // Keep failed/poster diagnostics while releasing the manager's owners.
        try { this.destroy(); } catch { /* Preserve the timeout diagnostic. */ }
      }
      // A failed scene must never break navigation: report and stay silent.
    }
  }

  /* ---------------- loop — page-…js:32000-32300 --------------- */

  markValleyReady(): void {
    if (this.destroyed) return;
    this.valleyReady = true;
    this.clock.getDelta();
    this.startRender();
  }

  private startRender(): void {
    if (this.destroyed || this.rafID || !this.valleyReady) return;
    this.rafID = window.requestAnimationFrame(this.onFrame);
  }

  private readonly onFrame = (): void => {
    if (this.destroyed) return;
    this.valleyScene.onFrameAlwaysRun();
    this.valleyScene.onFrame();
    // User progress/intro callbacks may synchronously destroy this owner.
    if (this.destroyed) return;
    this.valleyScene.render();

    const delta = this.clock.getDelta();
    this.frameTimes.push(delta);
    if (this.frameTimes.length > 30) this.frameTimes.shift();
    const mean =
      this.frameTimes.reduce((total, value) => total + value, 0) /
      Math.max(1, this.frameTimes.length);
    this.fps = mean > 0 ? Math.round(1 / mean) : 0;

    this.rafID = window.requestAnimationFrame(this.onFrame);
  };

  /* ---------------- transitions — page-…js:31050-31400 --------------- */

  startHoverTransition(): void {
    this.valleyScene.buttonHover = true;
    this.valleyScene.scroller?.toggleAutoScroll(false);
  }

  stopHoverTransition(): void {
    this.valleyScene.buttonHover = false;
    this.valleyScene.scroller?.toggleAutoScroll(true);
  }

  startExitTransition(): void {
    audioStore.muteBackgroundMusic();
    this.valleyScene.exit = true;
    if (this.exitTransitionProgress !== 1) {
      this.tweenTo(1, TRANSITION_DURATIONS.exitTransition);
    }
  }

  stopExitTransition(): void {
    if (this.exitTransitionProgress !== 0) {
      this.valleyScene.exit = false;
      this.tweenTo(0, TRANSITION_DURATIONS.exitTransition);
    }
  }

  /**
   * `class $` (the bundle's tiny tween) with its linear `q.FG` easing replaced by
   * the same `min(1, elapsed/duration)` ramp; the scene itself is eased by
   * `buttonHoverProgress`, exactly as on the live site.
   */
  private tweenTo(target: number, durationSeconds: number): void {
    if (this.exitTweenRaf) window.cancelAnimationFrame(this.exitTweenRaf);
    const from = this.exitTransitionProgress;
    const start = performance.now();
    const step = (): void => {
      if (this.destroyed) return;
      const elapsed = (performance.now() - start) / 1000;
      const t = durationSeconds <= 0 ? 1 : Math.min(1, elapsed / durationSeconds);
      this.exitTransitionProgress = from + (target - from) * t;
      if (t < 1) this.exitTweenRaf = window.requestAnimationFrame(step);
    };
    this.exitTweenRaf = window.requestAnimationFrame(step);
  }

  /* ---------------- sizing / pointer --------------- */

  private readonly onMouseMove = (event: PointerEvent): void => {
    this.valleyScene.onMouseMove(event);
  };

  updateSize(): void {
    const { innerWidth, innerHeight } = window;
    this.useBoostPerformance =
      innerWidth < this.performanceBoostModeDimensionCutoff ||
      innerHeight < this.performanceBoostModeDimensionCutoff;
    // `resizeRenderer` — the original passes an undefined `this.pixelRatio`,
    // which r154's `setPixelRatio` ignores; the composer drives the real size.
    this.renderer.setPixelRatio(this.valleyScene.pixelRatio);
    this.renderer.setSize(innerWidth, innerHeight);
    this.valleyScene.useBoostPerformance = this.useBoostPerformance;
    this.valleyScene.updateSize();
  }

  private readonly resize = (): void => {
    if (this.destroyed) return;
    this.updateSize();
    if (this.resizeTimeout !== undefined) clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(() => {
      if (!this.destroyed) this.updateSize();
    }, 50);
  };

  /* ---------------- QA surface --------------- */

  setTime(seconds: number): void {
    this.valleyScene.timeOverride = Math.max(0, seconds);
  }

  setProgress(pct: number): void {
    this.valleyScene.timeOverride = null;
    this.valleyScene.progressOverride = pct;
    this.valleyScene.scroller?.toggleAutoScroll(false);
  }

  releaseProgressControl(): void {
    this.valleyScene.timeOverride = null;
    this.valleyScene.progressOverride = null;
    this.valleyScene.scroller?.toggleAutoScroll(true);
  }

  setPointer(xNdc: number, yNdc: number): void {
    this.valleyScene.mouse.x = xNdc;
    this.valleyScene.mouse.y = yNdc;
    this.valleyScene.animMouse.set(xNdc, yNdc);
  }

  setDispersal(pct: number): void {
    this.valleyScene.dispersalOverride = pct;
  }

  releaseDispersal(): void {
    this.valleyScene.dispersalOverride = null;
  }

  setQuality(tier: QualityTier): void {
    this.valleyScene.qualityTier = tier;
    this.valleyScene.useBoostPerformance = tier === 'boost';
    this.valleyScene.effects();
    this.valleyScene.updateSize();
    if (this.status === 'ready') {
      // rebuild the cloud at the new density
      void this.valleyScene
        .reloadPlacement()
        .then(() => this.valleyScene.validatePrograms())
        .catch(() => {
          this.degradeReasons.push('placement-failed');
        });
    }
  }

  /** `true` once the intro camera angle has settled and the first frames ran. */
  isSettled(): boolean {
    return this.status === 'ready' && this.valleyScene.isAnimatedIn && this.fps > 0;
  }

  /**
   * Measurement-only: re-runs the shader's sizing/growth maths on the CPU so a
   * capture run can see *why* a frame is bright or dark. Renders nothing.
   */
  probe(stride = 7): FieldProbeReport | null {
    const points = this.valleyScene.points;
    if (!points) return null;
    const camera = this.valleyScene.camera;
    camera.updateMatrixWorld(true);
    this.valleyScene.cameraContainer.updateMatrixWorld(true);
    return probeField(
      points.geometry,
      this.valleyScene.uniforms,
      {
        projectionMatrix: camera.projectionMatrix,
        matrixWorldInverse: camera.matrixWorldInverse,
        position: camera.getWorldPosition(new Vector3()),
        near: camera.near,
        far: camera.far,
      },
      stride,
    );
  }

  /** World position of the animated `cameraContainer` — what `uContainerPos` tracks. */
  containerWorldPosition(): { x: number; y: number; z: number } {
    const world = this.valleyScene.cameraContainer.getWorldPosition(new Vector3());
    return { x: world.x, y: world.y, z: world.z };
  }

  getDiagnostics(): Diagnostics {
    const support = probeWebgl();
    const geometry = this.valleyScene.points?.geometry;
    return {
      mode: this.status === 'failed' ? 'poster' : this.valleyReady ? 'live' : 'booting',
      degraded:
        this.degradeReasons.length > 0 ||
        this.failures.length > 0 ||
        this.valleyScene.assetFailures.length > 0,
      degradeReasons: [...this.degradeReasons],
      quality: this.valleyScene.qualityTier,
      dpr: this.valleyScene.pixelRatio,
      composerPixelRatio: this.valleyScene.composerPixelRatio,
      maxPixelRatio: this.valleyScene.maxPixelRatio,
      pointCount: this.valleyScene.pointCount,
      drawCount: geometry?.index ? geometry.index.count : this.valleyScene.pointCount,
      runtimes: activeRuntimes,
      shaderIssues: this.valleyScene.shaderIssues,
      assetFailures: [...this.failures, ...this.valleyScene.assetFailures],
      webgl2: support.webgl2,
      renderer: support.rendererName,
      cameraAnimProgress: this.valleyScene.cameraAnimationProgress,
      dispersalProgress: this.valleyScene.uniforms.uDispersalProgress.value,
      fps: this.fps,
      placementMs: this.valleyScene.placementMs,
      bootMs: this.bootMs,
      introDone: this.valleyScene.isAnimatedIn,
    };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.valleyReady = false;
    const rafID = this.rafID;
    const exitTweenRaf = this.exitTweenRaf;
    const resizeTimeout = this.resizeTimeout;
    this.rafID = 0;
    this.exitTweenRaf = 0;
    this.resizeTimeout = undefined;

    releaseAll([
      () => window.cancelAnimationFrame(rafID),
      () => window.cancelAnimationFrame(exitTweenRaf),
      () => { if (resizeTimeout !== undefined) clearTimeout(resizeTimeout); },
      () => window.removeEventListener('resize', this.resize),
      () => window.removeEventListener('pointermove', this.onMouseMove),
      () => document.documentElement.classList.remove(DOM_CLASS_NAMES.htmlClass),
      () => this.valleyScene.dispose(),
      () => this.renderer.dispose(),
      () => { if (this.canvas.parentElement) this.canvas.parentElement.removeChild(this.canvas); },
      () => { activeRuntimes = Math.max(0, activeRuntimes - 1); },
      () => this.callbacks.onScrollProgress?.(0),
    ]);
  }
}

/* ------------------------------------------------------------------ *
 * helpers
 * ------------------------------------------------------------------ */

export function assetUrl(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`image failed: ${src}`));
    image.src = src;
  });
}
