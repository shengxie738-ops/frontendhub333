/**
 * GLSL registry / loader.
 *
 * Every entry is the *verbatim* original shader string extracted from the live
 * gladeye.com bundle (`evidence/source-assets/js/...`), kept in
 * `src/experience/glsl/<name>.glsl` and imported as raw text by webpack
 * (next.config.mjs). `scripts/verify-scene-params.mjs` asserts each file is
 * still byte-identical to its counterpart in `evidence/shaders/`.
 *
 * Nothing in this project re-writes, "optimises" or re-formats a shader: the
 * sources are handed to `THREE.ShaderMaterial` exactly as they come out of the
 * bundle, uniform names included.
 */
import flowerValleyPointsVertex from './flower-valley.points.vertex.glsl';
import flowerValleyPointsFragment from './flower-valley.points.fragment.glsl';
import dustPointsVertex from './dust.points.vertex.glsl';
import dustPointsFragment from './dust.points.fragment.glsl';
import godRaysVertex from './god-rays.vertex.glsl';
import godRaysFragment from './god-rays.fragment.glsl';
import vignetteVertex from './vignette.vertex.glsl';
import vignetteFragment from './vignette.fragment.glsl';
import postfxNoiseVertex from './postfx-noise.vertex.glsl';
import postfxNoiseFragment from './postfx-noise.fragment.glsl';
import postfxGlitchVertex from './postfx-glitch.vertex.glsl';
import postfxGlitchFragment from './postfx-glitch.fragment.glsl';

export type ShaderRole =
  | 'flowerPointsVertex'
  | 'flowerPointsFragment'
  | 'dustPointsVertex'
  | 'dustPointsFragment'
  | 'godRaysVertex'
  | 'godRaysFragment'
  | 'vignetteVertex'
  | 'vignetteFragment'
  | 'postfxNoiseVertex'
  | 'postfxNoiseFragment'
  | 'postfxGlitchVertex'
  | 'postfxGlitchFragment';

export interface ShaderRecord {
  readonly role: ShaderRole;
  /** Webpack module id + byte length recorded by the extractor. */
  readonly origin: string;
  readonly file: string;
  readonly source: string;
}

export const SHADERS: Readonly<Record<ShaderRole, ShaderRecord>> = {
  flowerPointsVertex: {
    role: 'flowerPointsVertex',
    origin: 'page-4c279de0997d388f.js module 9169 (18080 chars)',
    file: 'flower-valley.points.vertex.glsl',
    source: flowerValleyPointsVertex,
  },
  flowerPointsFragment: {
    role: 'flowerPointsFragment',
    origin: 'page-4c279de0997d388f.js module 4025 (6803 chars)',
    file: 'flower-valley.points.fragment.glsl',
    source: flowerValleyPointsFragment,
  },
  dustPointsVertex: {
    role: 'dustPointsVertex',
    origin: 'page-4c279de0997d388f.js module 7936 (2047 chars)',
    file: 'dust.points.vertex.glsl',
    source: dustPointsVertex,
  },
  dustPointsFragment: {
    role: 'dustPointsFragment',
    origin: 'page-4c279de0997d388f.js module 526 (729 chars)',
    file: 'dust.points.fragment.glsl',
    source: dustPointsFragment,
  },
  godRaysVertex: {
    role: 'godRaysVertex',
    origin: 'page-4c279de0997d388f.js module 2551 (334 chars)',
    file: 'god-rays.vertex.glsl',
    source: godRaysVertex,
  },
  godRaysFragment: {
    role: 'godRaysFragment',
    origin: 'page-4c279de0997d388f.js module 5249 (3755 chars)',
    file: 'god-rays.fragment.glsl',
    source: godRaysFragment,
  },
  vignetteVertex: {
    role: 'vignetteVertex',
    origin: 'page-4c279de0997d388f.js module 9744 (267 chars)',
    file: 'vignette.vertex.glsl',
    source: vignetteVertex,
  },
  vignetteFragment: {
    role: 'vignetteFragment',
    origin: 'page-4c279de0997d388f.js module 5165 (1161 chars)',
    file: 'vignette.fragment.glsl',
    source: vignetteFragment,
  },
  postfxNoiseVertex: {
    role: 'postfxNoiseVertex',
    origin: '596-40a806be0d0d2bb3.js module 5593 (offset 52212)',
    file: 'postfx-noise.vertex.glsl',
    source: postfxNoiseVertex,
  },
  postfxNoiseFragment: {
    role: 'postfxNoiseFragment',
    origin: 'page-4c279de0997d388f.js module 4291 (2883 chars)',
    file: 'postfx-noise.fragment.glsl',
    source: postfxNoiseFragment,
  },
  postfxGlitchVertex: {
    role: 'postfxGlitchVertex',
    origin: '596-40a806be0d0d2bb3.js module 2289 (offset 47731)',
    file: 'postfx-glitch.vertex.glsl',
    source: postfxGlitchVertex,
  },
  postfxGlitchFragment: {
    role: 'postfxGlitchFragment',
    origin: 'page-4c279de0997d388f.js module 255 (1417 chars)',
    file: 'postfx-glitch.fragment.glsl',
    source: postfxGlitchFragment,
  },
};

/** Flat list used by the diagnostics bridge and the param verifier. */
export const ALL_SHADER_RECORDS: readonly ShaderRecord[] = Object.values(SHADERS);

/**
 * Returns the GLSL sources for a `THREE.ShaderMaterial`.
 * `depthTest:false / transparent:true` stay at the call sites because the
 * original sets them per-material, not inside the shaders.
 */
export function shaderPair(role: 'flower' | 'dust' | 'godRays' | 'vignette' | 'noise' | 'glitch'): {
  vertexShader: string;
  fragmentShader: string;
} {
  switch (role) {
    case 'flower':
      return { vertexShader: SHADERS.flowerPointsVertex.source, fragmentShader: SHADERS.flowerPointsFragment.source };
    case 'dust':
      return { vertexShader: SHADERS.dustPointsVertex.source, fragmentShader: SHADERS.dustPointsFragment.source };
    case 'godRays':
      return { vertexShader: SHADERS.godRaysVertex.source, fragmentShader: SHADERS.godRaysFragment.source };
    case 'vignette':
      return { vertexShader: SHADERS.vignetteVertex.source, fragmentShader: SHADERS.vignetteFragment.source };
    case 'noise':
      return { vertexShader: SHADERS.postfxNoiseVertex.source, fragmentShader: SHADERS.postfxNoiseFragment.source };
    case 'glitch':
      return { vertexShader: SHADERS.postfxGlitchVertex.source, fragmentShader: SHADERS.postfxGlitchFragment.source };
  }
}
