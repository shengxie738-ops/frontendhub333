/**
 * Post-processing chain — verbatim port of `effects()` /
 * `calculateSplitPassIntensity()` / `updateSize()` from
 * `page-4c279de0997d388f.js:12340-13060` and `:18260-18900`.
 *
 * `EffectComposer(renderer)` → `RenderPass(scene, camera)` →
 * `UnrealBloomPass(new Vector2(w,h), 1.5, .4, .85)` whose strengths are then
 * overwritten by `settings.bloomParams` → the custom noise `ShaderPass`
 * (the original's "splitPass"). Under `useBoostPerformance` the whole chain is
 * removed and the scene renders directly, exactly like the original.
 *
 * The route-transition glitch pass (modules 255/2289) is also implemented but —
 * matching the shipped bundle — never added to the composer: the live page
 * performs route exits with `uDispersalProgress` plus a page fade, and
 * `updateGlitchDistortion()` has no caller there. It is kept drivable so the QA
 * bridge and an integrator can exercise it.
 */
import {
  PerspectiveCamera,
  Scene,
  Vector2,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { POST_PROCESSING, SCENE_SETTINGS } from '../data/scene-settings';
import { shaderPair } from '../glsl';
import type { GlitchPassUniforms, NoisePassUniforms } from '../types';

export interface PostFX {
  composer: EffectComposer;
  renderPass: RenderPass;
  bloomPass: UnrealBloomPass;
  noisePass: ShaderPass;
  noiseUniforms: NoisePassUniforms;
}

/**
 * `calculateSplitPassIntensity()` — `max(min(1 - (1-e)*.6, 1), .4)` with
 * `e = (innerWidth - 768) / 672`.
 */
export function calculateSplitPassIntensity(): number {
  const width =
    typeof window === 'undefined'
      ? POST_PROCESSING.splitIntensity.breakpoint
      : window.innerWidth;
  const e =
    (width - POST_PROCESSING.splitIntensity.breakpoint) / POST_PROCESSING.splitIntensity.range;
  return Math.max(
    Math.min(1 - (1 - e) * POST_PROCESSING.splitIntensity.slope, 1),
    POST_PROCESSING.splitIntensity.floor,
  );
}

/** `new UnrealBloomPass(...)` keeps its own `exposure` field in the original even
 *  though three r154 no longer declares it (it is an inert assignment there too). */
type BloomPassWithExposure = UnrealBloomPass & { exposure: number };

export function createPostFX(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: PerspectiveCamera,
): PostFX {
  const { innerWidth, innerHeight } = window;

  const renderPass = new RenderPass(scene, camera);

  const bloomPass = new UnrealBloomPass(
    new Vector2(innerWidth, innerHeight),
    POST_PROCESSING.bloomConstructor.strength,
    POST_PROCESSING.bloomConstructor.radius,
    POST_PROCESSING.bloomConstructor.threshold,
  );

  const composer = new EffectComposer(renderer);
  composer.addPass(renderPass);

  // `settings.bloomParams` overwrites the constructor values (EVIDENCE.md §8).
  (bloomPass as BloomPassWithExposure).exposure = SCENE_SETTINGS.bloomParams.exposure;
  bloomPass.threshold = SCENE_SETTINGS.bloomParams.threshold;
  bloomPass.strength = SCENE_SETTINGS.bloomParams.strength;
  bloomPass.radius = SCENE_SETTINGS.bloomParams.radius;

  const pair = shaderPair('noise');
  const noisePass = new ShaderPass(
    {
      uniforms: {
        time: { value: 0 },
        res: { value: [innerWidth, innerHeight] },
        tDiffuse: { value: null },
        uTextureResolution: {
          value: new Vector2(
            POST_PROCESSING.noisePassTextureResolution[0],
            POST_PROCESSING.noisePassTextureResolution[1],
          ),
        },
        uNoiseAlpha: { value: SCENE_SETTINGS.uNoiseAlpha },
        // starts at 0 and is eased up to settings.uNoiseDensityThreshold during the intro
        uNoiseDensityThreshold: { value: POST_PROCESSING.noiseDensityThresholdInitial },
        intensity: { value: calculateSplitPassIntensity() },
      },
      vertexShader: pair.vertexShader,
      fragmentShader: pair.fragmentShader,
    },
    'tDiffuse',
  );

  composer.addPass(bloomPass);
  composer.addPass(noisePass);

  return { composer, renderPass, bloomPass, noisePass, noiseUniforms: noisePass.uniforms as NoisePassUniforms };
}

export function resizePostFX(fx: PostFX, width: number, height: number, pixelRatio: number): void {
  fx.composer.setSize(width, height);
  fx.composer.setPixelRatio(pixelRatio);
  fx.noiseUniforms.res.value = [width, height];
  fx.noiseUniforms.intensity.value = calculateSplitPassIntensity();
}

export function disposePostFX(fx: PostFX): void {
  fx.bloomPass.dispose();
  fx.noisePass.dispose();
  fx.renderPass.dispose();
  fx.composer.dispose();
}

/* ------------------------------------------------------------------ *
 * Dormant route-transition glitch pass (modules 255 / 2289)
 * ------------------------------------------------------------------ */

export interface GlitchPassHandle {
  pass: ShaderPass;
  uniforms: GlitchPassUniforms;
  /** `updateGlitchDistortion()` — random offset in both axes (page-…js:32046). */
  randomiseDistortion(): void;
  /** driven by `exitTransitionProgress` */
  setProgress(progress: number): void;
  dispose(): void;
}

export function createGlitchPass(
  input: Texture | null,
  settings: { glitchMultiplier: number; shiftMultiplier: number; darkenFactor: number },
): GlitchPassHandle {
  const pair = shaderPair('glitch');
  const pass = new ShaderPass(
    {
      uniforms: {
        uFade: { value: 0 },
        uDiffuse1: { value: input },
        uGlitchAmount: { value: 0 },
        uDarkenFactor: { value: settings.darkenFactor },
        uDistortion: { value: new Vector2(0, 0) },
        uGlitchMultiplier: { value: settings.glitchMultiplier },
        uShiftMultiplier: { value: settings.shiftMultiplier },
      },
      vertexShader: pair.vertexShader,
      fragmentShader: pair.fragmentShader,
    },
    'uDiffuse1',
  );
  const uniforms = pass.uniforms as GlitchPassUniforms;

  return {
    pass,
    uniforms,
    randomiseDistortion(): void {
      uniforms.uDistortion.value = new Vector2(Math.random() - 0.5, Math.random() - 0.5);
    },
    setProgress(progress: number): void {
      uniforms.uFade.value = progress;
      uniforms.uGlitchAmount.value = progress;
    },
    dispose(): void {
      pass.dispose();
    },
  };
}
