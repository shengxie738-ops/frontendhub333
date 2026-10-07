/**
 * Simplex noise, verbatim port of the `simplex-noise` module the original
 * bundle ships (`evidence/source-assets/js/596-40a806be0d0d2bb3.js:6990`,
 * module `7973`, exports `hA` = `createNoise2D`, `zz` = `createNoise3D`).
 *
 * `terrainLookUp` fills two of the point attributes with these:
 *   aTerrainNoise    = 0.5 * noise3D(.4x, .4y, .4z)
 *   aFlowerGrowNoise =     noise2D(.4x, .4y)
 * so the gradient tables, the `70`/`32` output scales, the `0.5`/`0.6` surflet
 * radii and the permutation shuffle must match bit-for-bit or the valley stops
 * looking like the original.
 */
import { alea, type RandomFunction } from './prng';

/** F2 */
const F2 = 0.5 * (Math.sqrt(3) - 1);
/** G2 */
const G2 = (3 - Math.sqrt(3)) / 6;
/** F3 */
const F3 = 1 / 3;
/** G3 */
const G3 = 1 / 6;

const fastFloor = (value: number): number => 0 | Math.floor(value);

const GRAD2 = new Float64Array([
  1, 1, -1, 1, 1, -1, -1, -1, 1, 0, -1, 0, 1, 0, -1, 0, 0, 1, 0, -1, 0, 1, 0, -1,
]);
const GRAD3 = new Float64Array([
  1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1,
  1, 0, 1, -1, 0, -1, -1,
]);

/** `buildPermutationTable` — 512-entry shuffled table mirrored into its top half. */
function buildPermutationTable(random: RandomFunction): Uint8Array {
  const perm = new Uint8Array(512);
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 0; i < 255; i++) {
    const r = i + ~~(random() * (256 - i));
    const aux = perm[i];
    perm[i] = perm[r];
    perm[r] = aux;
  }
  for (let i = 256; i < 512; i++) perm[i] = perm[i - 256];
  return perm;
}

export type Noise2D = (x: number, y: number) => number;
export type Noise3D = (x: number, y: number, z: number) => number;

/** module `7973` export `hA`. */
export function createNoise2D(random: RandomFunction = Math.random): Noise2D {
  const perm = buildPermutationTable(random);
  const gradX = new Float64Array(perm).map((v) => GRAD2[(v % 12) * 2]);
  const gradY = new Float64Array(perm).map((v) => GRAD2[(v % 12) * 2 + 1]);

  return function noise2D(x: number, y: number): number {
    let i1: number;
    let j1: number;
    let n0 = 0;
    let n1 = 0;
    let n2 = 0;

    const skewSum = (x + y) * F2;
    const i0 = fastFloor(x + skewSum);
    const j0 = fastFloor(y + skewSum);
    const unskew = (i0 + j0) * G2;
    const x0 = x - (i0 - unskew);
    const y0 = y - (j0 - unskew);

    if (x0 > y0) {
      i1 = 1;
      j1 = 0;
    } else {
      i1 = 0;
      j1 = 1;
    }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;

    const ii = 255 & i0;
    const jj = 255 & j0;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      const gi0 = ii + perm[jj];
      t0 *= t0;
      n0 = t0 * t0 * (gradX[gi0] * x0 + gradY[gi0] * y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      const gi1 = ii + i1 + perm[jj + j1];
      t1 *= t1;
      n1 = t1 * t1 * (gradX[gi1] * x1 + gradY[gi1] * y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      const gi2 = ii + 1 + perm[jj + 1];
      t2 *= t2;
      n2 = t2 * t2 * (gradX[gi2] * x2 + gradY[gi2] * y2);
    }

    return 70 * (n0 + n1 + n2);
  };
}

/** module `7973` export `zz`. */
export function createNoise3D(random: RandomFunction = Math.random): Noise3D {
  const perm = buildPermutationTable(random);
  const gradX = new Float64Array(perm).map((v) => GRAD3[(v % 12) * 3]);
  const gradY = new Float64Array(perm).map((v) => GRAD3[(v % 12) * 3 + 1]);
  const gradZ = new Float64Array(perm).map((v) => GRAD3[(v % 12) * 3 + 2]);

  return function noise3D(x: number, y: number, z: number): number {
    let n0 = 0;
    let n1 = 0;
    let n2 = 0;
    let n3 = 0;

    const skewSum = (x + y + z) * F3;
    const i0 = fastFloor(x + skewSum);
    const j0 = fastFloor(y + skewSum);
    const k0 = fastFloor(z + skewSum);
    const unskew = (i0 + j0 + k0) * G3;
    const x0 = x - (i0 - unskew);
    const y0 = y - (j0 - unskew);
    const z0 = z - (k0 - unskew);

    let i1: number;
    let j1: number;
    let k1: number;
    let i2: number;
    let j2: number;
    let k2: number;

    if (x0 >= y0) {
      if (y0 >= z0) {
        i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0;
      } else if (x0 >= z0) {
        i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1;
      } else {
        i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1;
      }
    } else {
      if (y0 < z0) {
        i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1;
      } else if (x0 < z0) {
        i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1;
      } else {
        i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0;
      }
    }

    const x1 = x0 - i1 + G3;
    const y1 = y0 - j1 + G3;
    const z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3;
    const y2 = y0 - j2 + 2 * G3;
    const z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3;
    const y3 = y0 - 1 + 3 * G3;
    const z3 = z0 - 1 + 3 * G3;

    const ii = 255 & i0;
    const jj = 255 & j0;
    const kk = 255 & k0;

    let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 < 0) {
      n0 = 0;
    } else {
      const gi0 = ii + perm[jj + perm[kk]];
      t0 *= t0;
      n0 = t0 * t0 * (gradX[gi0] * x0 + gradY[gi0] * y0 + gradZ[gi0] * z0);
    }

    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t1 < 0) {
      n1 = 0;
    } else {
      const gi1 = ii + i1 + perm[jj + j1 + perm[kk + k1]];
      t1 *= t1;
      n1 = t1 * t1 * (gradX[gi1] * x1 + gradY[gi1] * y1 + gradZ[gi1] * z1);
    }

    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (t2 < 0) {
      n2 = 0;
    } else {
      const gi2 = ii + i2 + perm[jj + j2 + perm[kk + k2]];
      t2 *= t2;
      n2 = t2 * t2 * (gradX[gi2] * x2 + gradY[gi2] * y2 + gradZ[gi2] * z2);
    }

    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (t3 < 0) {
      n3 = 0;
    } else {
      const gi3 = ii + 1 + perm[jj + 1 + perm[kk + 1]];
      t3 *= t3;
      n3 = t3 * t3 * (gradX[gi3] * x3 + gradY[gi3] * y3 + gradZ[gi3] * z3);
    }

    return 32 * (n0 + n1 + n2 + n3);
  };
}

/** The exact seeded pair used by the original placement (`seedrandom("seed")`). */
export function createSeededNoise(seed: string): { noise2D: Noise2D; noise3D: Noise3D } {
  return {
    // `b.hA(F()(seed))`
    noise2D: createNoise2D(alea(seed)),
    // `b.zz(F()(seed))`
    noise3D: createNoise3D(alea(seed)),
  };
}
