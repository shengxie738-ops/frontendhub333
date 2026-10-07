/**
 * Vignette overlay, ported verbatim from the `class j extends THREE.Group` in
 * `evidence/source-assets/js/app/page-4c279de0997d388f.js:7560-8120`.
 *
 * It is a full-clip-space quad (`PlaneGeometry(2, 2)` + a vertex shader that
 * writes `gl_Position = vec4(position, 1.0)` un-projected), `renderOrder: 99`,
 * `depthTest/depthWrite:false`, and its alpha is the red channel of
 * `valley/vignette.png` plus `uShrinkFactor`, which the frame loop feeds with
 * `remap(|scrollVelocity|, 0, 10, 0, .5)` eased at `.05` per frame.
 */
import { Group, Mesh, PlaneGeometry, ShaderMaterial, Texture, Vector2 } from 'three';
import { VIGNETTE } from '../data/scene-settings';
import { shaderPair } from '../glsl';
import type { VignetteUniforms } from '../types';

export interface VignetteLayerOptions {
  texture: Texture;
  renderOrder?: number;
}

export class VignetteLayer extends Group {
  readonly uniforms: VignetteUniforms;
  readonly mesh: Mesh;
  private readonly geometry: PlaneGeometry;
  private readonly material: ShaderMaterial;
  shrinkTarget = 0;

  constructor({ texture, renderOrder = VIGNETTE.renderOrder }: VignetteLayerOptions) {
    super();

    this.uniforms = {
      uVignetteTexture: { value: texture },
      uShrinkFactor: { value: 0 },
      uTextureResolution: {
        value: new Vector2(
          (texture.source.data as { width: number }).width,
          (texture.source.data as { height: number }).height,
        ),
      },
      uScreenResolution: { value: new Vector2(window.innerWidth, window.innerHeight) },
      res: { value: new Vector2(window.innerWidth, window.innerHeight) },
    };

    const pair = shaderPair('vignette');
    this.geometry = new PlaneGeometry(VIGNETTE.planeSize[0], VIGNETTE.planeSize[1]);
    this.material = new ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: pair.vertexShader,
      fragmentShader: pair.fragmentShader,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });

    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.renderOrder = renderOrder;
    this.mesh.frustumCulled = false;
    this.add(this.mesh);

    window.addEventListener('resize', this.resize);
  }

  private readonly resize = (): void => {
    const { innerWidth, innerHeight } = window;
    this.uniforms.uScreenResolution.value = new Vector2(innerWidth, innerHeight);
    this.uniforms.res.value = new Vector2(innerWidth, innerHeight);
  };

  update(): void {
    this.uniforms.uShrinkFactor.value +=
      (this.shrinkTarget - this.uniforms.uShrinkFactor.value) * VIGNETTE.shrinkEase;
  }

  setShrinkage(value: number): void {
    this.shrinkTarget = value;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    window.removeEventListener('resize', this.resize);
  }
}
