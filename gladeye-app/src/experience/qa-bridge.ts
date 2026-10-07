/**
 * Development test bridge — `window.__GLADEYE_QA__`.
 *
 * Installed only when `process.env.NODE_ENV !== 'production'` (a production
 * build leaves `window.__GLADEYE_QA__` undefined), and only from the client.
 * It is the seam E2E runs use to drive the valley deterministically:
 * time / pointer / camera progress / dispersal / quality, plus `getDiagnostics()`
 * which reports shader compile errors, failed assets, live runtime count,
 * current quality, whether the scene degraded to the static poster, dpr and the
 * point count.
 */
import { ALL_SHADER_RECORDS } from './glsl';
import type { Diagnostics, QualityTier } from './types';
import type { HomeExperience } from './ValleyScene';

let current: HomeExperience | null = null;
let poster: Diagnostics | null = null;
let installed = false;

export function registerExperience(experience: HomeExperience | null): void {
  current = experience;
  if (experience) poster = null;
}

/** Used by the hero when the live scene is skipped (no WebGL / reduced motion). */
export function registerPosterFallback(diagnostics: Diagnostics | null): void {
  poster = diagnostics;
}

const SETTLE_TIMEOUT_MS = 45000;

function makeBridge(): QaBridgeImpl {
  return {
    version: '1',
    build: 'development',

    setTime(seconds: number): void {
      current?.setTime(seconds);
    },
    setPointer(xNdc: number, yNdc: number): void {
      current?.setPointer(xNdc, yNdc);
    },
    setProgress(pct: number): void {
      current?.setProgress(pct);
    },
    setDispersal(pct: number): void {
      current?.setDispersal(pct);
    },
    setQuality(tier: QualityTier): void {
      current?.setQuality(tier);
    },
    startExitTransition(): void {
      current?.startExitTransition();
    },
    getShaderSources(): Record<string, string> {
      const out: Record<string, string> = {};
      for (const record of ALL_SHADER_RECORDS) out[record.role] = record.source;
      return out;
    },
    getDiagnostics(): Diagnostics {
      if (current) return current.getDiagnostics();
      if (poster) return poster;
      return emptyDiagnostics();
    },
    /** Measurement-only CPU re-run of the vertex shader's sizing/growth maths. */
    probe(stride?: number): unknown {
      if (!current) return null;
      const field = current.probe(stride ?? 7);
      return {
        field,
        container: current.containerWorldPosition(),
        progress: current.valleyScene.cameraAnimationProgress,
        scroller: current.valleyScene.scroller?.getScrollStats() ?? null,
        uniforms: {
          uContainerPos: current.valleyScene.uniforms.uContainerPos.value.toArray(),
          uTotalZ: current.valleyScene.uniforms.uTotalZ.value,
          uCamNear: current.valleyScene.uniforms.uCamNear.value,
          uCamFar: current.valleyScene.uniforms.uCamFar.value,
          uCamFov: current.valleyScene.uniforms.uCamFov.value,
          res: current.valleyScene.uniforms.res.value.toArray(),
        },
      };
    },
    waitUntilSettled(): Promise<void> {
      return new Promise((resolve) => {
        const startedAt = performance.now();
        const tick = (): void => {
          if (!current) {
            if (poster || performance.now() - startedAt > SETTLE_TIMEOUT_MS) {
              resolve();
              return;
            }
          } else if (current.isSettled() || current.status === 'failed') {
            resolve();
            return;
          }
          if (performance.now() - startedAt > SETTLE_TIMEOUT_MS) {
            resolve();
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    },
  };
}

export function emptyDiagnostics(): Diagnostics {
  return {
    mode: 'poster',
    degraded: true,
    degradeReasons: ['webgl-unavailable'],
    quality: 'high',
    dpr: 0,
    composerPixelRatio: 0,
    maxPixelRatio: 0,
    pointCount: 0,
    drawCount: 0,
    runtimes: 0,
    shaderIssues: [],
    assetFailures: [],
    webgl2: false,
    renderer: '',
    cameraAnimProgress: 0,
    dispersalProgress: 0,
    fps: 0,
    placementMs: 0,
    bootMs: 0,
    introDone: false,
  };
}

interface QaBridgeImpl {
  readonly version: '1';
  readonly build: 'development';
  setTime(seconds: number): void;
  setPointer(xNdc: number, yNdc: number): void;
  setProgress(pct: number): void;
  setDispersal(pct: number): void;
  setQuality(tier: QualityTier): void;
  waitUntilSettled(): Promise<void>;
  getDiagnostics(): Diagnostics;
  probe(stride?: number): unknown;
  startExitTransition(): void;
  getShaderSources(): Record<string, string>;
}

/** Idempotent; returns a teardown that only removes *this* bridge. */
export function installQaBridge(): () => void {
  if (typeof window === 'undefined') return () => undefined;
  if (process.env.NODE_ENV === 'production') return () => undefined;
  if (installed) return () => undefined;
  installed = true;
  const bridge = makeBridge();
  window.__GLADEYE_QA__ = bridge;
  return () => {
    if (window.__GLADEYE_QA__ === bridge) {
      delete window.__GLADEYE_QA__;
      installed = false;
    }
  };
}
