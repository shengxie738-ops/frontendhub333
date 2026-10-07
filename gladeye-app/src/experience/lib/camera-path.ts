/**
 * The baked camera path of `/valley/camera-path07.glb` (EVIDENCE.md §4).
 *
 * The original drives the camera with `THREE.AnimationMixer` over the GLB's
 * single `Action.001` clip (200 keys, LINEAR interpolation, t ∈ [0, 8.291667] s
 * ⇒ 24 fps). The keys were already decoded verbatim into
 * `src/experience/data/camera-path07.json` by `scripts/extract-camera-path.mjs`,
 * so the identical result is reproduced here without `GLTFLoader` (and without
 * the `/assets/draco/` decoder): the sampler below re-implements three's
 * `LinearInterpolant` / `QuaternionLinearInterpolant` on those exact key arrays,
 * and `CameraAnimator` re-implements the `CameraAnim` wrapper verbatim
 * (page-4c279de0997d388f.js:3300-4180), including its `0.4` position ease,
 * its `cameraMaxDistanceDiff` z-threshold and its `rotation.copy()`.
 */
import { Object3D, Quaternion, Vector3 } from 'three';
import cameraPathJson from '../data/camera-path07.json';
import { CAMERA_ANIM, CAMERA_CLIP } from '../data/scene-settings';

type Vec3Key = readonly [number, number, number] | readonly number[];
type Vec4Key = readonly [number, number, number, number] | readonly number[];

interface CameraPathChannel {
  readonly path: string;
  readonly interpolation: string;
  readonly values: readonly (Vec3Key | Vec4Key)[];
}

interface CameraPathFile {
  readonly meta: {
    readonly keyframeCount: number;
    readonly timeRange: readonly [number, number];
    readonly fps: string;
  };
  readonly times: readonly number[];
  readonly channels: Readonly<Record<string, CameraPathChannel>>;
}

const file = cameraPathJson as unknown as CameraPathFile;

const TRANSLATION = file.channels['0'];
const ROTATION = file.channels['1'];
const SCALE = file.channels['2'];

/** `clip.duration` in the original == the last key time of the GLB sampler. */
export const CLIP_DURATION = file.meta.timeRange[1];
export const KEY_COUNT = file.times.length;

if (KEY_COUNT !== CAMERA_CLIP.keyframes || TRANSLATION.values.length !== KEY_COUNT) {
  // Fail loudly rather than silently rendering a half-loaded path.
  throw new Error(
    `camera-path07.json: expected ${CAMERA_CLIP.keyframes} keys, got ${KEY_COUNT} / ${TRANSLATION.values.length}`,
  );
}

/** Index helper mirroring `three`'s `AnimationClip.findInsertIndex` (linear scan is exact for 200 keys). */
function segmentIndex(times: readonly number[], time: number): number {
  if (time <= times[0]) return 1;
  const last = times.length - 1;
  if (time >= times[last]) return last;
  for (let i = 1; i <= last; i++) {
    if (times[i] > time) return i;
  }
  return last;
}

export interface CameraPathSample {
  position: Vector3;
  quaternion: Quaternion;
  scale: Vector3;
}

/**
 * Samples the three baked channels at absolute clip time `time`
 * (seconds). `mixer.setTime(t)` is equivalent to this for LINEAR tracks.
 */
export function sampleCameraPath(time: number, out?: CameraPathSample): CameraPathSample {
  const target: CameraPathSample = out ?? {
    position: new Vector3(),
    quaternion: new Quaternion(),
    scale: new Vector3(),
  };

  const times = file.times;
  const i = segmentIndex(times, time);
  const i0 = i - 1;
  const t0 = times[i0];
  const t1 = times[i];
  const span = t1 - t0;
  const alpha = span === 0 ? 0 : Math.min(1, Math.max(0, (time - t0) / span));

  const p0 = TRANSLATION.values[i0] as number[];
  const p1 = TRANSLATION.values[i] as number[];
  target.position.set(
    p0[0] + (p1[0] - p0[0]) * alpha,
    p0[1] + (p1[1] - p0[1]) * alpha,
    p0[2] + (p1[2] - p0[2]) * alpha,
  );

  const q0 = ROTATION.values[i0] as number[];
  const q1 = ROTATION.values[i] as number[];
  target.quaternion.slerpQuaternions(
    new Quaternion(q0[0], q0[1], q0[2], q0[3]),
    new Quaternion(q1[0], q1[1], q1[2], q1[3]),
    alpha,
  );

  const s0 = SCALE.values[i0] as number[];
  const s1 = SCALE.values[i] as number[];
  target.scale.set(
    s0[0] + (s1[0] - s0[0]) * alpha,
    s0[1] + (s1[1] - s0[1]) * alpha,
    s0[2] + (s1[2] - s0[2]) * alpha,
  );

  return target;
}

/**
 * `class d` in the bundle: keeps a virtual `gltfCam` object, eases the target
 * `object3d` (the real `cameraContainer`) towards it and returns the *raw*
 * baked camera position — which is what the shader receives as `uContainerPos`.
 */
export class CameraAnimator {
  progress = 0;
  ease = 1;
  prevPct: number | undefined = undefined;
  /** the equivalent of `gltf.cameras[0]` — the animated, unsmoothed path camera. */
  readonly gltfCam: Object3D;
  private readonly clipDuration: number;
  private readonly object3d: Object3D;
  private readonly sampleTarget: CameraPathSample;

  constructor(object3d: Object3D, clipDuration: number = CLIP_DURATION) {
    this.object3d = object3d;
    this.clipDuration = clipDuration;
    this.gltfCam = new Object3D();
    this.gltfCam.name = 'Camera';
    this.sampleTarget = { position: new Vector3(), quaternion: new Quaternion(), scale: new Vector3() };
    // `mixer.update(0)` + `mixer.setTime(0)` in the original constructor.
    this.applySample(0);
  }

  /** `getTime()` in the bundle — `clip.duration * pct % 1`. */
  getTime(): number {
    return this.progress;
  }

  private applySample(time: number): void {
    sampleCameraPath(time, this.sampleTarget);
    this.gltfCam.position.copy(this.sampleTarget.position);
    this.gltfCam.quaternion.copy(this.sampleTarget.quaternion);
    this.gltfCam.scale.copy(this.sampleTarget.scale);
  }

  /**
   * Verbatim port of `update(pct, doCopy = true, easeDefault = .4, zThreshold = 10)`.
   * Returns a clone of the baked camera position, exactly like the original.
   */
  update(
    pct: number,
    doCopy = true,
    easeDefault: number = CAMERA_ANIM.defaultEase,
    zThreshold: number = CAMERA_ANIM.maxDistanceDiff,
  ): Vector3 {
    if (this.prevPct !== undefined) {
      const delta = this.prevPct - pct;
      this.ease = delta > CAMERA_ANIM.wrapEaseReset ? 1 : easeDefault;
    }

    this.progress = (this.clipDuration * pct) % 1;
    this.applySample(this.clipDuration * pct);

    if (doCopy) {
      const target = this.gltfCam.position.clone();
      this.object3d.position.x += (target.x - this.object3d.position.x) * CAMERA_ANIM.positionEase;
      this.object3d.position.y += (target.y - this.object3d.position.y) * CAMERA_ANIM.positionEase;

      const dz = this.gltfCam.position.z - this.object3d.position.z;
      if (dz > zThreshold) this.ease = 1;
      if (dz < -zThreshold) this.ease = 1;
      this.object3d.position.z += dz * this.ease;
      this.object3d.rotation.copy(this.gltfCam.rotation);
    }

    this.prevPct = pct;
    return this.gltfCam.position.clone();
  }

  destroy(): void {
    this.gltfCam.clear();
  }
}
