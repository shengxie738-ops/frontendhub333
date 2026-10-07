import type { Color, Matrix4, Texture, Vector2, Vector3, Vector4 } from 'three';

/* ------------------------------------------------------------------ *
 * Scene settings (EVIDENCE.md §3, verbatim)
 * ------------------------------------------------------------------ */

/** `bloomParams` sub-object of the original `this.settings`. */
export type BloomParams = {
  exposure: number;
  strength: number;
  threshold: number;
  radius: number;
};

/**
 * The literal `this.settings` object of the original `FlowerValley` scene
 * constructor. Field set and values are asserted 1:1 against EVIDENCE.md §3 by
 * `scripts/verify-scene-params.mjs`.
 */
export type SceneSettings = {
  threshold: number;
  strength: number;
  radius: number;
  exposure: number;
  cameraMaxRotationX: number;
  cameraMaxRotationY: number;
  fovMultiplier: number;
  uCamNear: number;
  uCamFar: number;
  uTerrainOffsetX: number;
  uTerrainOffsetY: number;
  uFlowerBaseScale: number;
  uLeavesBaseScale: number;
  uFlowerBloomDistance: number;
  uLeafGrowDistance: number;
  uRepulsionStrength: number;
  uBrightnessOnTouch: number;
  uNegativeSpaceDeepness: number;
  uSpriteSheetMix: number;
  uSigmoidSteepness: number;
  uDustSize: number;
  uMaxAlpha: number;
  uFadeSpeed: number;
  cameraMaxDistanceDiff: number;
  cameraEase: number;
  fadingMouse: boolean;
  mouseDebug: boolean;
  uInteractionPositionOffset: number;
  uNoiseAlpha: number;
  uNoiseDensityThreshold: number;
  bloomParams: BloomParams;
  uMaxDispersedPosX: number;
  uMaxDispersedPosY: number;
  dispersalAmountMultiplier: number;
  dispersalRandomnessWeight: number;
  dispersalIsFlowerWeight: number;
  dispersalPositionYWeight: number;
};

/* ------------------------------------------------------------------ *
 * Quality tiers
 * ------------------------------------------------------------------ */

/**
 * `high`   = the default device path (`T 2000 / D 400 / N 15 / E 30`, composer on)
 * `balanced` = the bundle's `useBoostPerformance` placement numbers with the
 *              post chain kept (1500 / 100 / 10 / 20)
 * `boost`  = same placement, composer + bloom + noise pass removed
 *            (exactly what `useBoostPerformance` does in the original)
 */
export type QualityTier = 'high' | 'balanced' | 'boost';

/* ------------------------------------------------------------------ *
 * Uniform plumbing (no `any`: every uniform bag is a mapped type)
 * ------------------------------------------------------------------ */

export type UniformValue =
  | number
  | boolean
  | Vector2
  | Vector3
  | Vector4
  | Color
  | Matrix4
  | Texture
  | number[]
  | Float32Array
  | null;

/** `{ name: { value: T } }` bag derived from a value map; assignable to three's `IUniform` record. */
export type Uniforms<T extends Record<keyof T, UniformValue>> = {
  [K in keyof T]: { value: T[K] };
};

export type FlowerUniformValues = {
  uTime: number;
  uTotalZ: number;
  uContainerPos: Vector3;
  uTerrainOffsetX: number;
  uTerrainOffsetY: number;
  uLeavesBaseScale: number;
  uFlowerBaseScale: number;
  uFlowerBloomDistance: number;
  uLeafGrowDistance: number;
  uNegativeSpaceDeepness: number;
  uRepulsionStrength: number;
  uBrightnessOnTouch: number;
  uCamNear: number;
  uCamFar: number;
  uLuminosity: Texture | null;
  uCanvasTexture: Texture | null;
  uSpriteSheetPool: Texture | null;
  uSpriteSheetPool2: Texture | null;
  uSpriteSheetMix: number;
  uSigmoidSteepness: number;
  uInteractionPositionOffset: number;
  uStartEndIndexPool_0: Vector2;
  uStartEndIndexPool_1: Vector2;
  uStartEndIndexPool_2: Vector2;
  uStartEndIndexLeaves: Vector2;
  uStartEndIndexFloor: Vector2;
  uPoolSheetSize: Vector2;
  uAmountOfSprites: Vector2;
  res: Vector2;
  uComposerPixelRatio: number;
  uBrightness: number;
  uDispersalProgress: number;
  uCamFov: number;
  uCamFovBase: number;
  uDispersalAmountMultiplier: number;
  uMaxDispersedPosX: number;
  uMaxDispersedPosY: number;
  uDispersalRandomnessWeight: number;
  uDispersalIsFlowerWeight: number;
  uDispersalPositionYWeight: number;
  uMousePosition: Vector2;
  uResolution: Vector2;
};

export type FlowerUniforms = Uniforms<FlowerUniformValues>;

export type VignetteUniformValues = {
  uVignetteTexture: Texture | null;
  uShrinkFactor: number;
  uTextureResolution: Vector2;
  uScreenResolution: Vector2;
  res: Vector2;
};

export type VignetteUniforms = Uniforms<VignetteUniformValues>;

export type NoisePassUniformValues = {
  time: number;
  res: number[];
  tDiffuse: Texture | null;
  uTextureResolution: Vector2;
  uNoiseAlpha: number;
  uNoiseDensityThreshold: number;
  intensity: number;
};

export type NoisePassUniforms = Uniforms<NoisePassUniformValues>;

export type GlitchPassUniformValues = {
  uFade: number;
  uDiffuse1: Texture | null;
  uGlitchAmount: number;
  uDarkenFactor: number;
  uDistortion: Vector2;
  uGlitchMultiplier: number;
  uShiftMultiplier: number;
};

export type GlitchPassUniforms = Uniforms<GlitchPassUniformValues>;

export type DustUniformValues = {
  uTime: number;
  uDustSize: number;
  uContainerPos: Vector3;
  uCamNear: number;
  uCamFar: number;
  uDispersalProgress: number;
  uTexture: Texture | null;
};

export type DustUniforms = Uniforms<DustUniformValues>;

export type GodRayUniformValues = {
  uTime: number;
  uFadeSpeed: number;
  uScrollPos: number;
  uScrollPos2: number;
  uScrollPos3: number;
  uMaxAlpha: number;
  uFlip: number;
  uPositionOffset: number;
  uShowRay: number;
  uRay1: Texture | null;
  uRay2: Texture | null;
  uRay3: Texture | null;
  uScreenResolution: Vector2;
  uTextureResolution: Vector2;
  uCamNear: number;
  uCamFar: number;
};

export type GodRayUniforms = Uniforms<GodRayUniformValues>;

/* ------------------------------------------------------------------ *
 * Diagnostics / QA bridge
 * ------------------------------------------------------------------ */

export type DegradeReason =
  | 'webgl-unavailable'
  | 'prefers-reduced-motion'
  | 'asset-load-failed'
  | 'shader-compile-failed'
  | 'placement-failed'
  | 'renderer-crashed';

export interface ShaderIssue {
  readonly name: string;
  readonly stage: 'vertex' | 'fragment' | 'program' | 'material';
  readonly message: string;
}

export interface AssetIssue {
  readonly url: string;
  readonly kind: 'texture' | 'model' | 'audio' | 'image-data';
  readonly message: string;
}

export interface Diagnostics {
  /** 'live' = real-time Three.js valley, 'poster' = static readable fallback. */
  readonly mode: 'live' | 'booting' | 'poster';
  readonly degraded: boolean;
  readonly degradeReasons: readonly DegradeReason[];
  readonly quality: QualityTier;
  readonly dpr: number;
  readonly composerPixelRatio: number;
  readonly maxPixelRatio: number;
  readonly pointCount: number;
  readonly drawCount: number;
  readonly runtimes: number;
  readonly shaderIssues: readonly ShaderIssue[];
  readonly assetFailures: readonly AssetIssue[];
  readonly webgl2: boolean;
  readonly renderer: string;
  readonly cameraAnimProgress: number;
  readonly dispersalProgress: number;
  readonly fps: number;
  readonly placementMs: number;
  readonly bootMs: number;
  readonly introDone: boolean;
}

export interface QaBridge {
  readonly version: '1';
  readonly build: 'development';
  setTime(seconds: number): void;
  setPointer(xNdc: number, yNdc: number): void;
  setProgress(pct: number): void;
  setDispersal(pct: number): void;
  setQuality(tier: QualityTier): void;
  waitUntilSettled(): Promise<void>;
  getDiagnostics(): Diagnostics;
  /** Not part of the required contract, but needed by real E2E runs. */
  startExitTransition(): void;
  getShaderSources(): Readonly<Record<string, string>>;
}

declare global {
  interface Window {
    __GLADEYE_QA__?: QaBridge;
  }
}

/* ------------------------------------------------------------------ *
 * Hero content (Storyblok rich-text shape used by the original)
 * ------------------------------------------------------------------ */

export interface RichTextNode {
  readonly type: string;
  readonly text?: string;
  readonly marks?: readonly { readonly type: string }[];
}

export interface RichTextDoc {
  readonly content?: readonly RichTextNode[];
}

export interface HeroMessage {
  readonly _uid: string;
  readonly content?: readonly RichTextDoc[];
}

export interface FlowerValleyContent {
  readonly hero_messages_bloks: readonly HeroMessage[];
  readonly cta: { readonly cached_url?: string; readonly url?: string } | null;
  readonly cta_text: string;
}
