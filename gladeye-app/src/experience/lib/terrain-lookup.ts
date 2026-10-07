/**
 * `terrainLookUp` — the CPU placement generator, ported verbatim from
 * `evidence/source-assets/js/app/page-4c279de0997d388f.js:4180-6870`
 * (minified `z = (e,t,n,i) => {...}`, plus its `R` pixel-cache and `I` hash
 * helpers at `:4100-4200`).
 *
 * This is the function that gives the site its identity: it walks the *baked
 * camera path* row by row (`T` rows × `D` columns), reads `terrain.png`
 * (100×129, one texel per column/row band) and lays the sprite points into a
 * valley channel:
 *
 *  - `aValleySide = col <= D/2 ? -1 : 1`  → left / right flank of the channel;
 *    the vertex shader turns it into `offsetDirection = aValleySide * -1.` so
 *    every plant leans back towards the centre.
 *  - `x = camX + 1.5*B + W*H + G*Y` where `W = 2.5*sin(1.5*x)*|E|` (walls) and
 *    `G = -E^3*sign(E)*B` (cubic pull into the channel) — the centre stays open.
 *  - `y = -2 + |cos(n)|*A*(1+.5*Y)` with `n` sweeping 0 → -π across the row, so
 *    the *middle* columns sit at floor level and the outer ones rise: the dark
 *    negative space in the centre is where the hero copy lives.
 *  - `terrainNoise` (seeded simplex 3D × 0.5) decides leaf-vs-flower
 *    (`isLeaf = uNegativeSpaceDeepness > terrainNoise`) and, together with the
 *    white texels of `terrain.png`, decides which points are discarded
 *    (`aIsFloorDiscard`).
 *  - red texels become the floor sprite pool; the three palette colours become
 *    flower pools 1/2/3.
 *  - finally every attribute array is re-appended with its own first 20 %, the
 *    duplicate positions shifted by `cameraPathEnd.z` so the far distance keeps
 *    foreground-like density.
 *
 * ONE deliberate deviation from the bundle (our own geometry, not an original
 * constant): each row's *world z* is the path sample at `(row + 0.5) / T` instead
 * of `row / (T - 1)`, i.e. the placement grid is offset half a row in z from the
 * camera path. See the `staggeredZ` block below — the un-staggered row plane made
 * `abs(pos.z - uContainerPos.z)` exactly 0 at `pct` 0 and 1 and cost 3e8 Mpx of
 * overdraw per frame. Everything else, including the noise coordinates, is the
 * ported original.
 */
import type { Vector3 } from 'three';
import { TERRAIN_PLACEMENT } from '../data/scene-settings';
import { hashYNoise, remap } from './math';
import { createSeededNoise } from './simplex-noise';

export interface TerrainPlacement {
  aIsFloorDiscards: number[];
  aIsFloorPool: number[];
  aSpriteScales: number[];
  positions: number[];
  random: number[];
  aColorCoordinates: number[];
  aValleySides: number[];
  isFirstRow: number[];
  noiseCoordinates: number[];
  aPoolId: number[];
  aTerrainNoise: number[];
  aYNoise: number[];
  aFlowerGrowNoise: number[];
}

export interface TerrainCameraAnim {
  /** `CameraAnimator.update(pct, doCopy)` — returns a clone of the baked camera position. */
  update(pct: number, doCopy?: boolean): Vector3;
}

export interface TerrainLookupOptions {
  cameraAnim: TerrainCameraAnim;
  terrainImage: HTMLImageElement;
  uNegativeSpaceDeepness: number;
  /** `T` */
  total: number;
  /** `D` */
  perRow: number;
  /** `A` (initial lateral amplitude) */
  seedAmplitude: number;
  /** `N` */
  depthJitterMin: number;
  /** `E` */
  depthJitterMax: number;
}

type RGB = { r: number; g: number; b: number };

/**
 * `R = e => { let t = {}; return { getColorFromPixel: ... } }` — a memoised
 * 1×1 `getImageData` reader (page-…js:4190).
 */
function createPixelCache(
  ctx: CanvasRenderingContext2D,
): { getColorFromPixel(x: number, y: number): RGB } {
  const cache: Record<number, Record<number, RGB> & { y?: number }> = {};
  return {
    getColorFromPixel(x: number, y: number): RGB {
      const col = Math.floor(x);
      const row = Math.floor(y);
      if (cache[col] !== undefined && (cache[col][row] as RGB | undefined) !== undefined) {
        return cache[col][row] as RGB;
      }
      const data = ctx.getImageData(col, row, 1, 1).data;
      const result: RGB = { r: data[0], g: data[1], b: data[2] };
      cache[col] = { y: row };
      cache[col][row] = result;
      return result;
    },
  };
}

/** `C = (r,g,b, R,G,B) => r===R && g===G && b===B` — exact colour key test (page-…js:4178). */
function colorEquals(r: number, g: number, b: number, tr: number, tg: number, tb: number): boolean {
  return r === tr && g === tg && b === tb;
}

function appendTwentyPercent(values: number[]): number[] {
  const P = TERRAIN_PLACEMENT.duplicateFraction;
  return values.concat(values.slice(0, Math.round(P * values.length)));
}

export function terrainLookUp(options: TerrainLookupOptions): TerrainPlacement {
  const {
    cameraAnim,
    terrainImage,
    uNegativeSpaceDeepness,
    total: T,
    perRow: D,
    seedAmplitude: A0,
    depthJitterMin: N,
    depthJitterMax: E_MAX,
  } = options;

  const positions: number[] = [];
  const farPositions: number[] = [];
  const aColorCoordinates: number[] = [];
  const aSpriteScales: number[] = [];
  const aIsFloorDiscards: number[] = [];
  const random: number[] = [];
  const aValleySides: number[] = [];
  const noiseCoordinates: number[] = [];
  const isFirstRow: number[] = [];
  const aTerrainNoise: number[] = [];
  const aYNoise: number[] = [];
  const aFlowerGrowNoise: number[] = [];
  const aIsFloorPool: number[] = [];
  const aPoolId: number[] = [];

  const size = { ...TERRAIN_PLACEMENT.lookupCanvas };
  const canvas = document.createElement('canvas');
  canvas.width = size.x;
  canvas.height = size.y;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('terrainLookUp: 2D context unavailable (willReadFrequently)');
  // the original also assigns the property directly after requesting it
  (ctx as CanvasRenderingContext2D & { willReadFrequently?: boolean }).willReadFrequently = true;
  ctx.fillStyle = TERRAIN_PLACEMENT.lookupFillStyle;
  ctx.drawImage(terrainImage, 0, 0);
  canvas.id = 'terrainLookUp';
  canvas.style.width = `${canvas.width}px`;
  canvas.style.height = `${canvas.height}px`;
  canvas.style.position = 'fixed';
  canvas.style.top = '0';

  const lookup = createPixelCache(ctx);

  const halfRow = Math.floor(D / 2);
  const farZ = cameraAnim.update(0.9999, false).z;

  const { noise2D, noise3D } = createSeededNoise(TERRAIN_PLACEMENT.seed);

  let A = A0;
  let O = 0;

  for (let row = 0; row < T; row++) {
    let columnAngle = 0;
    const rowProgress = row / (T - 1);
    const camPos = cameraAnim.update(rowProgress);
    O += (TERRAIN_PLACEMENT.rowAngleStepNumerator * Math.PI) / T;

    const pixelY = rowProgress * size.y;
    const rowSeeds = N + remap(Math.random(), 0, 1, 0, E_MAX - N);
    const rowStep = rowSeeds / D;

    // --- clone-side geometry fix: half-row z stagger -------------------------
    // `z = camPos.z` put row `r` *exactly* on the camera plane the path reaches
    // at `pct = r/(T-1)`, so at the two ends of the journey (`pct` = 0 and 1) the
    // render plane coincided with a placement row and the shader's
    // `pSize = uFlowerBaseScale / abs(pos.z - uContainerPos.z)` diverged:
    // `minAbsDz` 0.000, `gl_PointSize` 6.0e6 px, 3.4e8 Mpx of sprite area per frame
    // (`iteration-02.md` §2, re-measured before this change as `pre_sweep`).
    // Sampling the row's *world z* at the mid-point between two rows
    // (`(row + 0.5) / T`, strictly inside the clip so the last row cannot fall back
    // onto the seam) keeps `abs(dz)` >= half a row gap everywhere — the value the
    // journey already had mid-path (0.125). Everything the noise field is keyed on
    // (`x`, `y`, and the un-staggered `noiseZ` below) is untouched, so the leaf /
    // flower split, the discard mask and the lateral channel stay identical to the
    // previous run; only the plane the sprites sit in moved by half a row.
    const staggeredZ = cameraAnim.update((row + 0.5) / T, false).z;
    const noiseZ = camPos.z;

    for (let col = 0; col < D; col++) {
      const colProgress = col / (D - 1);
      const pixelX = colProgress * size.x;
      const colFraction = col / D;
      const rowFraction = row / T;
      const side = (colFraction - 0.5) * 2;
      const midColumn = halfRow - 0;
      const spread = col * rowStep - rowSeeds / 2;

      let x = camPos.x + TERRAIN_PLACEMENT.lateralSpread * spread;

      const wave =
        Math.sin((rowFraction + TERRAIN_PLACEMENT.rowWave.phase) * TERRAIN_PLACEMENT.rowWave.freqA) +
        Math.sin((rowFraction + TERRAIN_PLACEMENT.rowWave.phase) * TERRAIN_PLACEMENT.rowWave.freqB);
      const wall =
        TERRAIN_PLACEMENT.wall.amplitude *
        Math.sin(TERRAIN_PLACEMENT.wall.frequency * x) *
        Math.abs(side);
      const waveClamped = Math.max(0, Math.min(1, wave));
      const centrePull =
        -1 *
        Math.pow(side, TERRAIN_PLACEMENT.centrePull.exponent) *
        Math.sign(side) *
        spread;
      const waveClampedOffset = Math.max(0, Math.min(1, wave + TERRAIN_PLACEMENT.waveClampOffset));

      x = wall * waveClamped + centrePull * waveClampedOffset + x;

      const y =
        TERRAIN_PLACEMENT.height.base +
        Math.abs(Math.cos(columnAngle)) *
          A *
          (1 + TERRAIN_PLACEMENT.height.yWaveMix * waveClampedOffset);
      A =
        TERRAIN_PLACEMENT.height.amplitudeFloor +
        Math.cos(O) * Math.random() * TERRAIN_PLACEMENT.height.amplitudeJitter;
      columnAngle -= Math.PI / D;

      const z = staggeredZ;

      aValleySides.push(col <= midColumn ? -1 : 1);
      positions.push(x, y, z);
      farPositions.push(x, y, z + farZ);
      noiseCoordinates.push(x, y, noiseZ);

      const terrainNoise =
        TERRAIN_PLACEMENT.terrainNoiseMultiplier *
        noise3D(
          TERRAIN_PLACEMENT.noiseCoordinateScale * x,
          TERRAIN_PLACEMENT.noiseCoordinateScale * y,
          TERRAIN_PLACEMENT.noiseCoordinateScale * noiseZ,
        );
      aTerrainNoise.push(terrainNoise);
      aYNoise.push(hashYNoise([x, y]));
      aFlowerGrowNoise.push(
        noise2D(TERRAIN_PLACEMENT.noiseCoordinateScale * x, TERRAIN_PLACEMENT.noiseCoordinateScale * y),
      );

      const { r, g, b } = lookup.getColorFromPixel(pixelX, pixelY);
      const isWhite = colorEquals(r, g, b, ...TERRAIN_PLACEMENT.colors.white);
      const isRedFloor = colorEquals(r, g, b, ...TERRAIN_PLACEMENT.colors.redFloor);

      aIsFloorPool.push(isRedFloor ? 1 : 0);

      const isTooDeep =
        TERRAIN_PLACEMENT.tooDeepFactor * uNegativeSpaceDeepness > terrainNoise && !isRedFloor;
      const shouldDiscard = isWhite || isTooDeep;
      aIsFloorDiscards.push(shouldDiscard ? 1 : 0);

      if (colorEquals(r, g, b, ...TERRAIN_PLACEMENT.colors.pool0)) aPoolId.push(1);
      else if (colorEquals(r, g, b, ...TERRAIN_PLACEMENT.colors.pool1)) aPoolId.push(2);
      else if (colorEquals(r, g, b, ...TERRAIN_PLACEMENT.colors.pool2)) aPoolId.push(3);
      else aPoolId.push(0);

      aColorCoordinates.push(colFraction, rowFraction);

      const spriteScale =
        TERRAIN_PLACEMENT.spriteScale.min + Math.random() * TERRAIN_PLACEMENT.spriteScale.spread;
      aSpriteScales.push(spriteScale);
      random.push(Math.random());
      isFirstRow.push(row < TERRAIN_PLACEMENT.firstRowLimit ? 1 : 0);
    }
  }

  // `arr.concat(arr.slice(0, Math.round(.2 * arr.length)))` for every array,
  // positions taking the first 20 % of the *far-shifted* copies.
  return {
    aIsFloorDiscards: appendTwentyPercent(aIsFloorDiscards),
    aIsFloorPool: appendTwentyPercent(aIsFloorPool),
    aSpriteScales: appendTwentyPercent(aSpriteScales),
    positions: positions.concat(
      farPositions.slice(0, Math.round(TERRAIN_PLACEMENT.duplicateFraction * farPositions.length)),
    ),
    random: appendTwentyPercent(random),
    aColorCoordinates: appendTwentyPercent(aColorCoordinates),
    aValleySides: appendTwentyPercent(aValleySides),
    isFirstRow: appendTwentyPercent(isFirstRow),
    noiseCoordinates: appendTwentyPercent(noiseCoordinates),
    aPoolId: appendTwentyPercent(aPoolId),
    aTerrainNoise: appendTwentyPercent(aTerrainNoise),
    aYNoise: appendTwentyPercent(aYNoise),
    aFlowerGrowNoise: appendTwentyPercent(aFlowerGrowNoise),
  };
}
