/**
 * `field-probe` — a CPU re-implementation of the *sizing and growth* half of the
 * original flower vertex shader, used only as a measurement surface.
 *
 * It changes nothing about rendering: `HomeExperience.probe()` calls it to
 * answer, per frame, "how much sprite area is actually on screen and how far in
 * z is it?" — which is the quantity the reference luma tracks.
 *
 * Every formula below is transcribed line-for-line from
 * `src/experience/glsl/flower-valley.points.vertex.glsl` (EVIDENCE.md §6,
 * verbatim original):
 *
 *   offsetDirection  = aValleySide * -1.
 *   pos.y += terrainNoise * uTerrainOffsetY * yNoise
 *   pos.x += terrainNoise * uTerrainOffsetX * offsetDirection
 *   rawPos           = projectionMatrix * modelViewMatrix * position
 *   distanceOnScreen = rawPos.z
 *   halfBloomDist    = uFlowerBloomDistance * .5
 *   flowerBloomDistance = half + aFlowerGrowNoise * half
 *   startFlowerBloomDistance = flowerBloomDistance * (1.5 + aFlowerGrowNoise*.5)
 *   flowerPct = 1 - smoothstep(flowerBloomDistance, startFlowerBloomDistance, d)
 *   leafPct   = 1 - smoothstep(uLeafGrowDistance, uLeafGrowDistance*1.5, d)
 *   growthPct = sineOut(leafPct*isLeaf + flowerPct*(1-isLeaf))
 *   size      = uLeavesBaseScale*isLeaf + uFlowerBaseScale*(1-isLeaf)
 *   pSize     = size / abs(pos.z - uContainerPos.z)
 *   gl_PointSize = pSize*growthPct*aSpriteScale*.5*uComposerPixelRatio
 *                  *(res.y*.00125)*(uCamFovBase/uCamFov)
 *   finalPos.x += offsetX*(1 - powPctY);  finalPos.y += offsetY*(1 - powPctY)
 */
import type { BufferGeometry, Matrix4, Vector3 } from 'three';
import type { FlowerUniforms } from '../types';

export interface ProbeCamera {
  projectionMatrix: Matrix4;
  matrixWorldInverse: Matrix4;
  position: Vector3;
  near: number;
  far: number;
}

export interface FieldProbeReport {
  /** world-z / world-x / world-y extent of the point cloud. */
  bounds: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
  /** `uContainerPos` as the shader currently sees it. */
  containerZ: number;
  containerX: number;
  containerY: number;
  /** the real world position of the render camera (differs by `breathContainer`). */
  cameraWorldZ: number;
  cameraWorldX: number;
  cameraWorldY: number;
  total: number;
  sampled: number;
  discarded: number;
  /** points whose final NDC lands inside the viewport. */
  onScreen: number;
  /** on-screen points with `growthPct > 0.05`. */
  onScreenGrown: number;
  /** Σ gl_PointSize² over grown on-screen points — proxy for covered sprite area. */
  spriteArea: number;
  /** biggest single gl_PointSize among grown on-screen points. */
  maxPointSize: number;
  /** count of grown on-screen points bigger than 60px. */
  bigPoints: number;
  /** count of grown on-screen points bigger than 150px (the near bokeh blobs). */
  hugePoints: number;
  /** |pos.z - uContainerPos.z| histogram over grown on-screen points. */
  dzHistogram: Record<string, number>;
  /** gl_PointSize histogram over grown on-screen points. */
  sizeHistogram: Record<string, number>;
  /** mean growth of the nearest 20 world units of on-screen points. */
  meanNearGrowth: number;
  nearSampleCount: number;
  /** overdraw accounting, ignoring the frustum (what the GPU actually pays). */
  overdraw: {
    allGrown: number;
    /** Σ gl_PointSize² over every grown sprite, on-screen or not. */
    allGrownArea: number;
    giant500: number;
    giant2000: number;
    maxPointSize: number;
    minAbsDz: number;
  };
  /** projection constants actually in use, for the rawPos.z ↔ distance check. */
  projection: { near: number; far: number; clipZAt10: number; clipZAt24: number; clipZAt55: number };
}

const DZ_BANDS: Array<[string, number]> = [
  ['lt1', 1],
  ['1to2', 2],
  ['2to5', 5],
  ['5to10', 10],
  ['10to20', 20],
  ['20to40', 40],
  ['40to80', 80],
];

const SIZE_BANDS: Array<[string, number]> = [
  ['lt4', 4],
  ['4to12', 12],
  ['12to30', 30],
  ['30to80', 80],
  ['80to200', 200],
];

function smoothstep(edge0: number, edge1: number, x: number): number {
  const span = edge1 - edge0;
  if (Math.abs(span) < 1e-6) return x < edge0 ? 0 : 1;
  const t = Math.min(1, Math.max(0, (x - edge0) / span));
  return t * t * (3 - 2 * t);
}

/** `random(vec2 co)` from the shader, specialised to `vec2(position.x)` → `vec2(x, 0)`. */
function shaderRandomX(x: number): number {
  const v = Math.sin(x * 12.9898) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * Walks the geometry and returns the report. `stride` sub-samples the cloud so
 * the probe stays cheap (a full 800 k-point pass is ~40 ms).
 */
export function probeField(
  geometry: BufferGeometry,
  uniforms: FlowerUniforms,
  camera: ProbeCamera,
  stride = 7,
): FieldProbeReport {
  const positionAttr = geometry.getAttribute('position');
  const valleySideAttr = geometry.getAttribute('aValleySide');
  const terrainNoiseAttr = geometry.getAttribute('aTerrainNoise');
  const yNoiseAttr = geometry.getAttribute('aYNoise');
  const growNoiseAttr = geometry.getAttribute('aFlowerGrowNoise');
  const spriteScaleAttr = geometry.getAttribute('aSpriteScale');
  const discardAttr = geometry.getAttribute('aIsFloorDiscard');

  const position = positionAttr.array as Float32Array | number[];
  const valleySide = valleySideAttr.array as Float32Array | number[];
  const terrainNoise = terrainNoiseAttr.array as Float32Array | number[];
  const yNoise = yNoiseAttr.array as Float32Array | number[];
  const growNoise = growNoiseAttr.array as Float32Array | number[];
  const spriteScale = spriteScaleAttr.array as Float32Array | number[];
  const discard = discardAttr.array as Float32Array | number[];

  const count = positionAttr.count;
  const u = uniforms;
  const containerZ = u.uContainerPos.value.z;
  const containerX = u.uContainerPos.value.x;
  const containerY = u.uContainerPos.value.y;
  const negativeSpace = u.uNegativeSpaceDeepness.value;
  const terrainOffsetX = u.uTerrainOffsetX.value;
  const terrainOffsetY = u.uTerrainOffsetY.value;
  const halfBloom = u.uFlowerBloomDistance.value * 0.5;
  const leafGrow = u.uLeafGrowDistance.value;
  const relativeScale = u.res.value.y * 0.00125;
  const fovScale = u.uCamFovBase.value / u.uCamFov.value;
  const sizeFactor =
    0.5 * u.uComposerPixelRatio.value * relativeScale * fovScale;

  // three's projection matrix is column-major: clip.z = pe[10]*vz + pe[14],
  // clip.w = pe[11]*vz + pe[15]. For a symmetric perspective pe[11] = -1 and
  // pe[15] = 0, so clip.w == -viewZ and `rawPos.z` runs linearly from -near at
  // the near plane to +far at the far plane.
  const pe = camera.projectionMatrix.elements;
  const clipZOf = (viewZ: number): number => pe[10] * viewZ + pe[14];
  const near = camera.near;
  const far = camera.far;

  const ve = camera.matrixWorldInverse.elements;
  // column-major 4x4
  const toView = (x: number, y: number, z: number, out: [number, number, number]): void => {
    out[0] = ve[0] * x + ve[4] * y + ve[8] * z + ve[12];
    out[1] = ve[1] * x + ve[5] * y + ve[9] * z + ve[13];
    out[2] = ve[2] * x + ve[6] * y + ve[10] * z + ve[14];
  };
  const clipOf = (
    vx: number,
    vy: number,
    vz: number,
    out: [number, number, number, number],
  ): void => {
    out[0] = pe[0] * vx + pe[4] * vy + pe[8] * vz + pe[12];
    out[1] = pe[1] * vx + pe[5] * vy + pe[9] * vz + pe[13];
    out[2] = pe[2] * vx + pe[6] * vy + pe[10] * vz + pe[14];
    out[3] = pe[3] * vx + pe[7] * vy + pe[11] * vz + pe[15];
  };

  const bounds = {
    minX: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
    minZ: Number.POSITIVE_INFINITY,
    maxZ: Number.NEGATIVE_INFINITY,
  };

  const dzHistogram: Record<string, number> = {};
  for (const [key] of DZ_BANDS) dzHistogram[key] = 0;
  dzHistogram.gt80 = 0;
  const sizeHistogram: Record<string, number> = {};
  for (const [key] of SIZE_BANDS) sizeHistogram[key] = 0;
  sizeHistogram.gt200 = 0;

  let sampled = 0;
  let discarded = 0;
  let onScreen = 0;
  let onScreenGrown = 0;
  let spriteArea = 0;
  let maxPointSize = 0;
  let bigPoints = 0;
  let hugePoints = 0;
  let nearGrowthSum = 0;
  let nearSampleCount = 0;
  let allGrown = 0;
  let allGrownArea = 0;
  let giant500 = 0;
  let giant2000 = 0;
  let maxAllPointSize = 0;
  let minAbsDz = Number.POSITIVE_INFINITY;

  const view: [number, number, number] = [0, 0, 0];
  const clip: [number, number, number, number] = [0, 0, 0, 0];

  for (let i = 0; i < count; i += stride) {
    const px = position[i * 3];
    const py = position[i * 3 + 1];
    const pz = position[i * 3 + 2];
    sampled += 1;

    if (px < bounds.minX) bounds.minX = px;
    if (px > bounds.maxX) bounds.maxX = px;
    if (py < bounds.minY) bounds.minY = py;
    if (py > bounds.maxY) bounds.maxY = py;
    if (pz < bounds.minZ) bounds.minZ = pz;
    if (pz > bounds.maxZ) bounds.maxZ = pz;

    if (discard[i] > 0.5) {
      discarded += 1;
      continue;
    }

    const side = valleySide[i];
    const noise = terrainNoise[i];
    const offsetDirection = side * -1;
    const isLeaf = negativeSpace > noise ? 1 : 0;

    // terrain offset (this is the `pos` the shader feeds to `pSize`)
    const wx = px + noise * terrainOffsetX * offsetDirection;
    const wy = py + noise * terrainOffsetY * yNoise[i];
    const wz = pz;

    // `rawPos` uses the *un-offset* position
    toView(px, py, pz, view);
    const distanceOnScreen = clipZOf(view[2]);

    const gNoise = growNoise[i];
    const flowerBloomDistance = halfBloom + gNoise * halfBloom;
    const startFlower = flowerBloomDistance * (1.5 + gNoise * 0.5);
    const flowerPct = 1 - smoothstep(flowerBloomDistance, startFlower, distanceOnScreen);
    const leafPct = 1 - smoothstep(leafGrow, leafGrow * 1.5, distanceOnScreen);
    let growthPct = leafPct * isLeaf + flowerPct * (1 - isLeaf);
    growthPct = Math.sin(Math.min(1, Math.max(0, growthPct)) * (Math.PI / 2));

    const size = u.uLeavesBaseScale.value * isLeaf + u.uFlowerBaseScale.value * (1 - isLeaf);
    const dz = wz - containerZ;
    const absDz = Math.abs(dz);
    const pSize = size / (absDz < 1e-4 ? 1e-4 : absDz);
    const pointSize = pSize * growthPct * spriteScale[i] * sizeFactor;

    // Overdraw accounting is done BEFORE any frustum test: the GPU rasterises a
    // point's full square even when it hangs off the edge of the viewport, so a
    // handful of |dz|->0 sprites can cost hundreds of megapixels per frame.
    if (growthPct > 0.05 && pointSize > 0) {
      allGrown += 1;
      allGrownArea += pointSize * pointSize;
      if (pointSize > 500) giant500 += 1;
      if (pointSize > 2000) giant2000 += 1;
      if (pointSize > maxAllPointSize) maxAllPointSize = pointSize;
      if (absDz < minAbsDz) minAbsDz = absDz;
    }

    // on-screen test on the *final* clip position, including the growth offset
    toView(wx, wy, wz, view);
    let vx = view[0];
    let vy = view[1];
    const vzz = view[2];
    const randomOffset = shaderRandomX(px);
    vx += randomOffset * offsetDirection * isLeaf;
    vy -= randomOffset * isLeaf;

    clipOf(vx, vy, vzz, clip);
    const powPctY = growthPct * growthPct;
    const offsetX = -offsetDirection * noise;
    const offsetY = terrainOffsetY * -1;
    const clipX = clip[0] + offsetX + -powPctY * offsetX;
    const clipY = clip[1] + offsetY + -powPctY * offsetY;
    const clipW = clip[3];

    if (clipW <= 0) continue;
    const ndcX = clipX / clipW;
    const ndcY = clipY / clipW;
    if (Math.abs(ndcX) > 1.05 || Math.abs(ndcY) > 1.05) continue;

    onScreen += 1;
    if (growthPct <= 0.05 || pointSize <= 0) continue;

    onScreenGrown += 1;
    spriteArea += pointSize * pointSize;
    if (pointSize > maxPointSize) maxPointSize = pointSize;
    if (pointSize > 60) bigPoints += 1;
    if (pointSize > 150) hugePoints += 1;

    let banded = false;
    for (const [key, limit] of DZ_BANDS) {
      if (absDz < limit) {
        dzHistogram[key] += 1;
        banded = true;
        break;
      }
    }
    if (!banded) dzHistogram.gt80 += 1;

    let sBanded = false;
    for (const [key, limit] of SIZE_BANDS) {
      if (pointSize < limit) {
        sizeHistogram[key] += 1;
        sBanded = true;
        break;
      }
    }
    if (!sBanded) sizeHistogram.gt200 += 1;

    if (absDz < 20) {
      nearGrowthSum += growthPct;
      nearSampleCount += 1;
    }
  }

  return {
    bounds,
    containerZ,
    containerX,
    containerY,
    cameraWorldZ: camera.position.z,
    cameraWorldX: camera.position.x,
    cameraWorldY: camera.position.y,
    total: count,
    sampled,
    discarded,
    onScreen,
    onScreenGrown,
    spriteArea,
    maxPointSize,
    bigPoints,
    hugePoints,
    dzHistogram,
    sizeHistogram,
    meanNearGrowth: nearSampleCount ? nearGrowthSum / nearSampleCount : 0,
    nearSampleCount,
    overdraw: {
      allGrown,
      allGrownArea,
      giant500,
      giant2000,
      maxPointSize: maxAllPointSize,
      minAbsDz,
    },
    projection: {
      near: +near.toFixed(3),
      far: +far.toFixed(3),
      clipZAt10: +clipZOf(-10).toFixed(3),
      clipZAt24: +clipZOf(-24).toFixed(3),
      clipZAt55: +clipZOf(-55).toFixed(3),
    },
  };
}
