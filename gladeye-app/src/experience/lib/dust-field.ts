/**
 * Dust sprite layer — the two GLSL originals in `dust.points.*.glsl`
 * (`page-4c279de0997d388f.js` modules 7936 / 526).
 *
 * IMPORTANT EVIDENCE NOTE: the shipped page imports both shader modules
 * (`n(7936), n(526)` at `page-…js:7560`) but its `buildScene()` no longer
 * instantiates the layer — the statement that used to create it survives only
 * as the bare expression `this.useBoostPerformance,` immediately before the
 * depth sort (`page-…js:20770`). The site that renders on gladeye.com today is
 * flowers + vignette + post chain. This layer is therefore implemented and
 * wired, but **off by default** (`enableDormantLayers`), so the clone matches
 * the live render instead of the dead code.
 */
import { BufferAttribute, BufferGeometry, Points, ShaderMaterial, Texture, Vector3 } from 'three';
import { SCENE_SETTINGS, VIGNETTE } from '../data/scene-settings';
import { shaderPair } from '../glsl';
import type { DustUniforms } from '../types';

export interface DustFieldOptions {
  texture: Texture;
  count?: number;
  /** half-extent of the box the sprites are scattered in (world units). */
  extent?: { x: number; y: number; z: number };
  /** `position.z` offset relative to the camera path start. */
  depth?: number;
}

const DEFAULT_COUNT = 400;

export class DustField {
  readonly points: Points;
  private readonly geometry: BufferGeometry;
  private readonly material: ShaderMaterial;
  readonly uniforms: DustUniforms;

  constructor({ texture, count = DEFAULT_COUNT, extent, depth = 260 }: DustFieldOptions) {
    const half = extent ?? { x: 60, y: 18, z: 40 };

    const positions = new Float32Array(count * 3);
    const rotations = new Float32Array(count);
    const movementRanges = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 2 * half.x;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 2 * half.y;
      positions[i * 3 + 2] = -depth + (Math.random() - 0.5) * 2 * half.z;
      rotations[i] = Math.random();
      movementRanges[i * 3] = Math.random() * 4;
      movementRanges[i * 3 + 1] = Math.random() * 4;
      movementRanges[i * 3 + 2] = Math.random() * 4;
    }

    this.geometry = new BufferGeometry();
    this.geometry.setAttribute('position', new BufferAttribute(positions, 3));
    this.geometry.setAttribute('aRotation', new BufferAttribute(rotations, 1));
    this.geometry.setAttribute('aMovementRange', new BufferAttribute(movementRanges, 3));

    this.uniforms = {
      uTime: { value: 0 },
      uDustSize: { value: SCENE_SETTINGS.uDustSize },
      uContainerPos: { value: new Vector3(0, 0, 0) },
      uCamNear: { value: SCENE_SETTINGS.uCamNear },
      uCamFar: { value: SCENE_SETTINGS.uCamFar },
      uDispersalProgress: { value: 0 },
      uTexture: { value: texture },
    };

    const pair = shaderPair('dust');
    this.material = new ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: pair.vertexShader,
      fragmentShader: pair.fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });

    this.points = new Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = VIGNETTE.renderOrder - 1;
  }

  update(time: number, containerPos: Vector3, dispersalProgress: number): void {
    this.uniforms.uTime.value = time;
    this.uniforms.uContainerPos.value = containerPos;
    this.uniforms.uDispersalProgress.value = dispersalProgress;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
