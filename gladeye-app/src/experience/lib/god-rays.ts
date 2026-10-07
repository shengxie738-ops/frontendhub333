/**
 * God-ray layer — the GLSL originals in `god-rays.*.glsl`
 * (`page-4c279de0997d388f.js` modules 5249 / 2551).
 *
 * Same evidence caveat as `DustField`: modules 2551/5249 are imported by the
 * shipped page but no code in `buildScene()` instantiates the mesh any more, so
 * this layer is wired but **off by default**. `uShowRay` follows the shader's
 * own comment — `1` shows the ray, a huge value pushes the UV outside the verts.
 */
import {
  BufferGeometry,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Texture,
  Vector2,
} from 'three';
import { SCENE_SETTINGS } from '../data/scene-settings';
import { shaderPair } from '../glsl';
import type { GodRayUniforms } from '../types';

export interface GodRaysOptions {
  ray1: Texture;
  ray2: Texture;
  ray3: Texture;
  width?: number;
  height?: number;
}

export class GodRays {
  readonly mesh: Mesh;
  private readonly geometry: BufferGeometry;
  private readonly material: ShaderMaterial;
  readonly uniforms: GodRayUniforms;

  constructor({ ray1, ray2, ray3, width = 120, height = 90 }: GodRaysOptions) {
    this.uniforms = {
      uTime: { value: 0 },
      uFadeSpeed: { value: SCENE_SETTINGS.uFadeSpeed },
      uScrollPos: { value: 0 },
      uScrollPos2: { value: 0 },
      uScrollPos3: { value: 0 },
      uMaxAlpha: { value: SCENE_SETTINGS.uMaxAlpha },
      uFlip: { value: 0 },
      uPositionOffset: { value: 0 },
      uShowRay: { value: 1 },
      uRay1: { value: ray1 },
      uRay2: { value: ray2 },
      uRay3: { value: ray3 },
      uScreenResolution: { value: new Vector2(window.innerWidth, window.innerHeight) },
      uTextureResolution: {
        value: new Vector2(
          (ray1.source.data as { width: number }).width,
          (ray1.source.data as { height: number }).height,
        ),
      },
      uCamNear: { value: SCENE_SETTINGS.uCamNear },
      uCamFar: { value: SCENE_SETTINGS.uCamFar },
    };

    this.geometry = new PlaneGeometry(width, height);
    const pair = shaderPair('godRays');
    this.material = new ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: pair.vertexShader,
      fragmentShader: pair.fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });

    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
  }

  update(time: number, scrollPos: number): void {
    this.uniforms.uTime.value = time;
    this.uniforms.uScrollPos.value = scrollPos;
    this.uniforms.uScrollPos2.value = scrollPos * 1.31;
    this.uniforms.uScrollPos3.value = scrollPos * 0.73;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
