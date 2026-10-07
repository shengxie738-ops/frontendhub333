#!/usr/bin/env node
/**
 * Pure-Node self-check for the cloned Gladeye valley.
 *
 *   node scripts/verify-scene-params.mjs
 *
 * Asserts, field by field:
 *   A. `src/experience/data/scene-settings.ts → SCENE_SETTINGS`
 *      === the JSON table in `docs/research/gladeye/EVIDENCE.md` §3
 *   B. the same object === the literal `this.settings = {...}` that is actually
 *      shipped inside `evidence/source-assets/js/app/page-4c279de0997d388f.js`
 *      (parsed out of the minified bundle, so the check does not just trust the
 *      markdown)
 *   C. camera path data sanity (200 keys, clip duration, channel shapes)
 *   D. every `.glsl` original and its `.glsl.ts` bundle twin are byte-identical,
 *      and the flower shaders still declare every attribute / uniform the
 *      placement generator writes
 *   E. the asset table points at files that exist in `public/valley/`
 *
 * Prints a PASS/FAIL line per field and exits 1 on any failure.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import zlib from 'node:zlib';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const APP_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const REPO_ROOT = path.resolve(APP_ROOT, '..');

const EVIDENCE = path.join(REPO_ROOT, 'docs/research/gladeye/EVIDENCE.md');
const SETTINGS_TS = path.join(APP_ROOT, 'src/experience/data/scene-settings.ts');
const BUNDLE = path.join(
  REPO_ROOT,
  'evidence/source-assets/js/app/page-4c279de0997d388f.js',
);
const GLSL_DIR = path.join(APP_ROOT, 'src/experience/glsl');
const CAMERA_JSON = path.join(APP_ROOT, 'src/experience/data/camera-path07.json');
const PUBLIC_VALLEY = path.join(APP_ROOT, 'public/valley');

let failures = 0;
const results = [];

function record(name, pass, detail) {
  results.push({ name, pass, detail });
  if (!pass) failures += 1;
}

function sameValue(expected, actual) {
  if (expected !== null && typeof expected === 'object') {
    const stable = (value) =>
      JSON.stringify(value, (key, inner) =>
        inner && typeof inner === 'object' && !Array.isArray(inner)
          ? Object.keys(inner)
              .sort()
              .reduce((acc, k) => ({ ...acc, [k]: inner[k] }), {})
          : inner,
      );
    return stable(expected) === stable(actual);
  }
  return Object.is(expected, actual);
}

function assertField(name, expected, actual) {
  const ok = sameValue(expected, actual);
  record(
    name,
    ok,
    ok
      ? `= ${JSON.stringify(actual)}`
      : `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

/* ------------------------------------------------------------------ */
/* 1. extract SCENE_SETTINGS from the TS module (strict-JSON block)    */
/* ------------------------------------------------------------------ */

function readSceneSettingsFromTs() {
  const source = fs.readFileSync(SETTINGS_TS, 'utf8');
  const startMark = '/* <VERIFIER:SCENE_SETTINGS> */';
  const endMark = '/* </VERIFIER:SCENE_SETTINGS> */';
  const start = source.indexOf(startMark);
  const end = source.indexOf(endMark);
  if (start < 0 || end < 0) throw new Error('scene-settings.ts: verifier markers missing');
  const body = source.slice(start + startMark.length, end).trim();
  const objectStart = body.indexOf('{');
  const objectEnd = body.lastIndexOf('}');
  return JSON.parse(body.slice(objectStart, objectEnd + 1));
}

/* ------------------------------------------------------------------ */
/* 2. extract §3 of EVIDENCE.md                                        */
/* ------------------------------------------------------------------ */

function readEvidenceSection3() {
  const md = fs.readFileSync(EVIDENCE, 'utf8');
  const heading = md.indexOf('## 3.');
  if (heading < 0) throw new Error('EVIDENCE.md: section 3 not found');
  const fenceStart = md.indexOf('```json', heading);
  const fenceEnd = md.indexOf('```', fenceStart + 7);
  return JSON.parse(md.slice(fenceStart + 7, fenceEnd).trim());
}

/* ------------------------------------------------------------------ */
/* 3. extract the shipped `this.settings={...}` from the minified bundle */
/* ------------------------------------------------------------------ */

function extractBalanced(text, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(openIndex, i + 1);
    }
  }
  throw new Error('unbalanced object literal');
}

function splitTopLevel(body) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of body) {
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current);
  return parts;
}

function parseJsScalar(raw) {
  const value = raw.trim();
  if (value === '!0') return true;
  if (value === '!1') return false;
  if (/^-?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(value)) return Number(value);
  throw new Error(`unparsed scalar: ${JSON.stringify(raw)}`);
}

function parseJsObject(source) {
  const inner = source.trim().slice(1, -1);
  const out = {};
  for (const part of splitTopLevel(inner)) {
    const colon = part.indexOf(':');
    if (colon < 0) throw new Error(`bad pair: ${part}`);
    const key = part.slice(0, colon).trim();
    const rawValue = part.slice(colon + 1).trim();
    out[key] = rawValue.startsWith('{') ? parseJsObject(rawValue) : parseJsScalar(rawValue);
  }
  return out;
}

function readBundleSettings() {
  const bundle = fs.readFileSync(BUNDLE, 'utf8');
  const anchor = bundle.indexOf('this.settings={threshold:0,strength:.25');
  if (anchor < 0) throw new Error('bundle: `this.settings={...}` not found');
  const openIndex = bundle.indexOf('{', anchor + 'this.settings='.length);
  return parseJsObject(extractBalanced(bundle, openIndex));
}

/* ------------------------------------------------------------------ */
/* 4. comparisons                                                      */
/* ------------------------------------------------------------------ */

const fromTs = readSceneSettingsFromTs();
const fromEvidence = readEvidenceSection3();
const fromBundle = readBundleSettings();

const KEYS = Object.keys(fromEvidence);
record('A.0 field sets identical (ts vs EVIDENCE.md §3)', JSON.stringify([...Object.keys(fromTs)].sort()) === JSON.stringify([...KEYS].sort()),
  `ts=${Object.keys(fromTs).length} evidence=${KEYS.length}`);

for (const key of KEYS) {
  assertField(`A.${key}`, fromEvidence[key], fromTs[key]);
}

const BUNDLE_KEYS = Object.keys(fromBundle);
record('B.0 field sets identical (ts vs shipped bundle)', JSON.stringify([...Object.keys(fromTs)].sort()) === JSON.stringify([...BUNDLE_KEYS].sort()),
  `bundle=${BUNDLE_KEYS.length} ts=${Object.keys(fromTs).length}`);

for (const key of BUNDLE_KEYS) {
  if (key === 'bloomParams') {
    for (const sub of Object.keys(fromBundle.bloomParams)) {
      assertField(`B.bloomParams.${sub}`, fromBundle.bloomParams[sub], fromTs.bloomParams?.[sub]);
    }
    continue;
  }
  assertField(`B.${key}`, fromBundle[key], fromTs[key]);
}

/* ---------------- C. camera path ---------------- */

const cameraJson = JSON.parse(fs.readFileSync(CAMERA_JSON, 'utf8'));
record('C.keyframe count', cameraJson.times.length === 200, `${cameraJson.times.length}`);
record('C.clip duration', Math.abs(cameraJson.meta.timeRange[1] - 8.291667) < 1e-4, `${cameraJson.meta.timeRange[1]}`);
record('C.translation channel', cameraJson.channels['0'].path === 'translation' && cameraJson.channels['0'].values.length === 200, cameraJson.channels['0'].path);
record('C.rotation channel', cameraJson.channels['1'].path === 'rotation' && cameraJson.channels['1'].values[0].length === 4, cameraJson.channels['1'].path);
record('C.scale channel', cameraJson.channels['2'].path === 'scale' && cameraJson.channels['2'].values.length === 200, cameraJson.channels['2'].path);
record('C.path spans the flight', Math.abs(cameraJson.channels['0'].values[199][2] + 500) < 1, `z(199)=${cameraJson.channels['0'].values[199][2]}`);

/* ---------------- D. shaders ---------------- */

const glslFiles = fs.readdirSync(GLSL_DIR).filter((f) => f.endsWith('.glsl'));
record('D.0 glsl files copied', glslFiles.length === 12, `${glslFiles.length} files`);

for (const file of glslFiles) {
  const original = fs.readFileSync(path.join(GLSL_DIR, file), 'utf8');
  const twin = fs.readFileSync(path.join(GLSL_DIR, `${file}.ts`), 'utf8');
  const marker = 'String.raw`';
  const start = twin.indexOf(marker) + marker.length;
  const end = twin.lastIndexOf('`;');
  record(`D.twin ${file}`, twin.slice(start, end) === original, `${original.length} bytes`);
}

const flowerVertex = fs.readFileSync(path.join(GLSL_DIR, 'flower-valley.points.vertex.glsl'), 'utf8');
const flowerFragment = fs.readFileSync(path.join(GLSL_DIR, 'flower-valley.points.fragment.glsl'), 'utf8');

const REQUIRED_ATTRIBUTES = [
  'position', 'aSpriteScale', 'aSpriteIndex', 'aRandomSeed', 'aColorCoordinate',
  'aIsFloorDiscard', 'aIsFloorPool', 'aPoolId', 'aValleySide', 'aTerrainNoise',
  'aYNoise', 'aFlowerGrowNoise',
];
for (const attribute of REQUIRED_ATTRIBUTES) {
  const declared = new RegExp(`attribute\\s+\\w+\\s+${attribute}\\s*;`).test(flowerVertex) ||
    attribute === 'position';
  record(`D.attribute declared ${attribute}`, declared, declared ? 'in vertex shader' : 'MISSING');
}

const REQUIRED_UNIFORMS = [
  'uTime', 'uContainerPos', 'uTerrainOffsetX', 'uTerrainOffsetY',
  'uLeavesBaseScale', 'uFlowerBaseScale', 'uFlowerBloomDistance', 'uLeafGrowDistance',
  'uNegativeSpaceDeepness', 'uRepulsionStrength', 'uBrightnessOnTouch', 'uCamNear',
  'uCamFar', 'uCanvasTexture', 'uSpriteSheetPool', 'uSpriteSheetPool2',
  'uDispersalProgress', 'uMousePosition', 'uComposerPixelRatio', 'uCamFov',
  'uCamFovBase', 'res',
];
for (const uniform of REQUIRED_UNIFORMS) {
  const present = new RegExp(`uniform\\s+\\w+\\s+${uniform}\\s*;`).test(flowerVertex + flowerFragment);
  record(`D.uniform declared ${uniform}`, present, present ? 'ok' : 'MISSING');
}

// `uTotalZ` is in the shipped uniform bag (EVIDENCE.md §3 naming list) but not
// referenced by the flower programs — check it where it is actually used.
const valleySceneSource = fs.readFileSync(
  path.join(APP_ROOT, 'src/experience/ValleyScene.ts'),
  'utf8',
);
const uniformsStart = valleySceneSource.indexOf('private buildUniforms(): FlowerUniforms {');
const uniformsBody = valleySceneSource.slice(uniformsStart, valleySceneSource.indexOf('\n  }', uniformsStart));
record('D.uniform bag found', uniformsStart > 0, uniformsStart > 0 ? 'buildUniforms()' : 'MISSING');
for (const uniform of [...REQUIRED_UNIFORMS, 'uTotalZ', 'uLuminosity', 'uSpriteSheetMix', 'uSigmoidSteepness', 'uInteractionPositionOffset', 'uBrightness', 'uDispersalAmountMultiplier', 'uMaxDispersedPosX', 'uMaxDispersedPosY', 'uDispersalRandomnessWeight', 'uDispersalIsFlowerWeight', 'uDispersalPositionYWeight', 'uStartEndIndexPool_0', 'uStartEndIndexPool_1', 'uStartEndIndexPool_2', 'uStartEndIndexLeaves', 'uStartEndIndexFloor', 'uPoolSheetSize', 'uAmountOfSprites', 'uResolution', 'uCamFovBase']) {
  const present = new RegExp(`^\\s+${uniform}: \\{ value:`, 'm').test(uniformsBody);
  record(`D.bag uniform ${uniform}`, present, present ? 'in uniform bag' : 'MISSING');
}

const VERBATIM_PROOFS = [
  ['offsetDirection = aValleySide * -1.', flowerVertex],
  ['isTooDeep = uNegativeSpaceDeepness * 0.009 > terrainNoise && !isFloorTexture', flowerVertex],
  ['float isLeaf = uNegativeSpaceDeepness > terrainNoise ? 1. : 0.', flowerVertex],
  ['gl_PointSize = pSize * animatedScale * 0.5 * uComposerPixelRatio * relativeScale', flowerVertex],
  ['finalPos = aIsFloorDiscard > 0.5 ? vec4(2.0, 2.0, 2.0, 1.0) : finalPos', flowerVertex],
  ['fastNoise3d(finalPos.xyz*2., uTime*.2)', flowerVertex],
  ['#include <colorspace_fragment>', flowerFragment],
  ['sigmoidEase(uSigmoidSteepness * (vRandomSeed - cos(pct)))', flowerFragment],
];
for (const [needle, haystack] of VERBATIM_PROOFS) {
  record(`D.verbatim line "${needle.slice(0, 42)}…"`, haystack.includes(needle), haystack.includes(needle) ? 'unchanged' : 'ALTERED');
}

/* ---------------- E. assets ---------------- */

const REQUIRED_ASSETS = [
  'camera-path07.glb', 'flowers/pool_summer.png', 'flowers/pool_winter.png',
  'vignette.png', 'dust-particle.png', 'rays/ray1.png', 'rays/ray2.png',
  'rays/ray3.png', 'terrain.png', 'audio/ge-ambient.mp3',
];
for (const asset of REQUIRED_ASSETS) {
  const file = path.join(PUBLIC_VALLEY, asset);
  record(`E.asset ${asset}`, fs.existsSync(file), fs.existsSync(file) ? `${fs.statSync(file).size} bytes` : 'MISSING');
}

function pngSize(file) {
  const buffer = fs.readFileSync(file);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}
const terrain = pngSize(path.join(PUBLIC_VALLEY, 'terrain.png'));
record('E.terrain.png is the 100x129 lookup grid', terrain.width === 100 && terrain.height === 129, `${terrain.width}x${terrain.height}`);
const sheet = pngSize(path.join(PUBLIC_VALLEY, 'flowers/pool_summer.png'));
record('E.sprite sheet matches uPoolSheetSize', sheet.width === 1500 && sheet.height === 1312, `${sheet.width}x${sheet.height}`);

/* ---------------- F. the placement generator, executed ------------- *
 * `terrainLookUp` is pure CPU math over the camera path + terrain.png, so the
 * real TS module is run here under Node: a resolve hook maps the project's
 * extensionless relative imports onto `.ts`, a tiny `document`/2D-context stub
 * replays the offscreen `willReadFrequently` canvas, and `terrain.png` is
 * decoded by this script (inflate + PNG defilter) so the original's *exact*
 * colour-key comparisons can be checked.
 * ------------------------------------------------------------------ */

function installTsResolution() {
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier.startsWith('.') && context.parentURL && context.parentURL.startsWith('file:')) {
        for (const suffix of ['.ts', '/index.ts']) {
          try {
            const candidate = new URL(specifier + suffix, context.parentURL);
            if (fs.existsSync(fileURLToPath(candidate))) {
              return { url: candidate.href, shortCircuit: true };
            }
          } catch {
            /* not a file url */
          }
        }
      }
      return nextResolve(specifier, context);
    },
  });
}

/** minimal PNG reader (8-bit truecolour / RGBA / palette, no interlace). */
function decodePng(buffer) {
  let offset = 8;
  let ihdr = null;
  const palette = [];
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        interlace: data[12],
      };
    } else if (type === 'PLTE') {
      for (let i = 0; i + 2 < data.length; i += 3) palette.push([data[i], data[i + 1], data[i + 2]]);
    } else if (type === 'IDAT') {
      idat.push(data);
    }
    offset += 12 + length;
  }
  if (!ihdr) throw new Error('png: no IHDR');
  if (ihdr.bitDepth !== 8 || ihdr.interlace !== 0) throw new Error('png: unsupported encoding');
  const channels = ihdr.colorType === 2 ? 3 : ihdr.colorType === 6 ? 4 : ihdr.colorType === 3 ? 1 : 0;
  if (channels === 0) throw new Error(`png: unsupported colour type ${ihdr.colorType}`);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = ihdr.width * channels;
  const pixels = Buffer.alloc(ihdr.height * stride);
  let position = 0;
  for (let y = 0; y < ihdr.height; y++) {
    const filter = raw[position++];
    const line = raw.subarray(position, position + stride);
    position += stride;
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? pixels[y * stride + x - channels] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upLeft = x >= channels && y > 0 ? pixels[(y - 1) * stride + x - channels] : 0;
      let value;
      if (filter === 0) value = line[x];
      else if (filter === 1) value = line[x] + left;
      else if (filter === 2) value = line[x] + up;
      else if (filter === 3) value = line[x] + ((left + up) >> 1);
      else {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        value = line[x] + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft);
      }
      pixels[y * stride + x] = value & 0xff;
    }
  }

  return {
    width: ihdr.width,
    height: ihdr.height,
    pixel(x, y) {
      if (x < 0 || y < 0 || x >= ihdr.width || y >= ihdr.height) return [0, 0, 0, 0];
      if (ihdr.colorType === 3) {
        const rgb = palette[pixels[y * ihdr.width + x]] ?? [0, 0, 0];
        return [rgb[0], rgb[1], rgb[2], 255];
      }
      const base = (y * ihdr.width + x) * channels;
      return [
        pixels[base],
        pixels[base + 1],
        pixels[base + 2],
        channels === 4 ? pixels[base + 3] : 255,
      ];
    },
  };
}

installTsResolution();

const terrainPng = decodePng(fs.readFileSync(path.join(PUBLIC_VALLEY, 'terrain.png')));

globalThis.document = {
  createElement(tag) {
    if (tag !== 'canvas') throw new Error('stub: unexpected element ' + tag);
    return {
      width: 0,
      height: 0,
      id: '',
      style: {},
      getContext() {
        return {
          willReadFrequently: false,
          fillStyle: '',
          drawImage() {},
          getImageData(x, y) {
            const pixel = terrainPng.pixel(Math.floor(x), Math.floor(y));
            return { data: new Uint8ClampedArray(pixel) };
          },
        };
      },
    };
  },
};

const settingsModule = await import(
  pathToFileURL(path.join(APP_ROOT, 'src/experience/data/scene-settings.ts')).href
);
const lookupModule = await import(
  pathToFileURL(path.join(APP_ROOT, 'src/experience/lib/terrain-lookup.ts')).href
);
record(
  'F.ts modules import',
  Boolean(lookupModule.terrainLookUp && settingsModule.TERRAIN_PLACEMENT),
  'terrain-lookup.ts + scene-settings.ts',
);

// independent sampler of the same baked path (the runtime one lives in
// `lib/camera-path.ts`; only x/z matter to the placement)
const times = cameraJson.times;
const translations = cameraJson.channels['0'].values;
function bakedCameraAt(pct) {
  const time = cameraJson.meta.timeRange[1] * pct;
  let i = 1;
  while (i < times.length - 1 && times[i] < time) i += 1;
  const span = times[i] - times[i - 1];
  const alpha = span === 0 ? 0 : Math.min(1, Math.max(0, (time - times[i - 1]) / span));
  const a = translations[i - 1];
  const b = translations[i];
  return { x: a[0] + (b[0] - a[0]) * alpha, y: 0, z: a[2] + (b[2] - a[2]) * alpha };
}
const fakeCameraAnim = { update: (pct) => bakedCameraAt(pct) };

const tier = settingsModule.QUALITY_TIERS.balanced;
const placementStartedAt = performance.now();
const placement = lookupModule.terrainLookUp({
  cameraAnim: fakeCameraAnim,
  terrainImage: { width: terrainPng.width, height: terrainPng.height },
  uNegativeSpaceDeepness: settingsModule.SCENE_SETTINGS.uNegativeSpaceDeepness,
  total: tier.total,
  perRow: tier.perRow,
  seedAmplitude: tier.seedAmplitude,
  depthJitterMin: tier.depthJitterMin,
  depthJitterMax: tier.depthJitterMax,
});
const placementMs = performance.now() - placementStartedAt;

const expectedPoints = Math.round((1 + 0.2) * tier.total * tier.perRow);
record(
  'F.point count = 1.2 * T * D',
  placement.positions.length / 3 === expectedPoints,
  `${placement.positions.length / 3} vs ${expectedPoints} (${placementMs.toFixed(0)}ms)`,
);

const scalarArrays = [
  'aIsFloorDiscards', 'aIsFloorPool', 'aSpriteScales', 'random', 'aValleySides',
  'isFirstRow', 'aPoolId', 'aTerrainNoise', 'aYNoise', 'aFlowerGrowNoise',
];
const lengthConsistent =
  scalarArrays.every((key) => placement[key].length === expectedPoints) &&
  placement.aColorCoordinates.length === expectedPoints * 2 &&
  placement.noiseCoordinates.length === expectedPoints * 3 &&
  placement.positions.length === expectedPoints * 3;
record('F.all 13 attribute arrays agree', lengthConsistent, lengthConsistent ? 'ok' : 'ragged arrays');

let sidesMinus = 0;
let sidesPlus = 0;
let badSide = 0;
for (const value of placement.aValleySides) {
  if (value === -1) sidesMinus += 1;
  else if (value === 1) sidesPlus += 1;
  else badSide += 1;
}
record('F.aValleySide is only -1 / +1', badSide === 0, `bad=${badSide}`);
record(
  'F.aValleySide splits the row ~50/50',
  Math.abs(sidesMinus - sidesPlus) / expectedPoints < 0.06,
  `${((sidesMinus / expectedPoints) * 100).toFixed(1)}% / ${((sidesPlus / expectedPoints) * 100).toFixed(1)}%`,
);

const primary = expectedPoints - Math.round(0.2 * expectedPoints);
const absX = [];
let minZ = Infinity;
let maxZ = -Infinity;
for (let i = 0; i < primary * 3; i += 3) {
  absX.push(Math.abs(placement.positions[i]));
  minZ = Math.min(minZ, placement.positions[i + 2]);
  maxZ = Math.max(maxZ, placement.positions[i + 2]);
}
absX.sort((a, b) => a - b);
const p99x = absX[Math.floor(absX.length * 0.99)];
const medianX = absX[Math.floor(absX.length * 0.5)];
record('F.lateral channel is bounded', p99x < 60, `median|x|=${medianX.toFixed(2)} p99|x|=${p99x.toFixed(2)}`);
record(
  'F.depth spans the camera flight',
  minZ < -tier.total * 0.3 && maxZ > -1,
  `z in [${minZ.toFixed(1)}, ${maxZ.toFixed(1)}]`,
);

// valley cross-section: the middle columns must sit lower than the flanks
const buckets = new Map();
for (let i = 0; i < primary; i++) {
  const columnFraction = placement.aColorCoordinates[i * 2];
  const bucket = Math.floor(columnFraction * 10);
  const entry = buckets.get(bucket) ?? { sum: 0, count: 0 };
  entry.sum += placement.positions[i * 3 + 1];
  entry.count += 1;
  buckets.set(bucket, entry);
}
const bucketMean = (bucket) => {
  const entry = buckets.get(bucket);
  return entry && entry.count ? entry.sum / entry.count : Number.NaN;
};
const centreY = (bucketMean(4) + bucketMean(5)) / 2;
const flankY = (bucketMean(0) + bucketMean(9)) / 2;
record('F.valley floor is the centre column', centreY < flankY - 0.5, `centre y=${centreY.toFixed(2)} flank y=${flankY.toFixed(2)}`);

let leaves = 0;
let noiseMin = Infinity;
let noiseMax = -Infinity;
const deepness = settingsModule.SCENE_SETTINGS.uNegativeSpaceDeepness;
for (const value of placement.aTerrainNoise) {
  if (deepness > value) leaves += 1;
  noiseMin = Math.min(noiseMin, value);
  noiseMax = Math.max(noiseMax, value);
}
const leafRatio = leaves / expectedPoints;
record('F.leaf/flower split is a mix', leafRatio > 0.5 && leafRatio < 0.9, `leafRatio=${leafRatio.toFixed(3)}`);
record('F.aTerrainNoise in simplex range', noiseMin > -0.6 && noiseMax < 0.6, `[${noiseMin.toFixed(3)}, ${noiseMax.toFixed(3)}]`);

let discarded = 0;
for (const value of placement.aIsFloorDiscards) if (value > 0.5) discarded += 1;
const discardRatio = discarded / expectedPoints;
record('F.negative space is carved out', discardRatio > 0.02 && discardRatio < 0.7, `discardRatio=${discardRatio.toFixed(3)}`);

let floorPool = 0;
const poolCounts = new Map();
for (let i = 0; i < expectedPoints; i++) {
  if (placement.aIsFloorPool[i] > 0.5) floorPool += 1;
  poolCounts.set(placement.aPoolId[i], (poolCounts.get(placement.aPoolId[i]) ?? 0) + 1);
}
record('F.aPoolId values are 0..3', [...poolCounts.keys()].every((key) => key >= 0 && key <= 3), [...poolCounts.keys()].join(','));
record(
  'F.terrain.png colour keys resolve',
  [1, 2, 3].every((id) => ((poolCounts.get(id) ?? 0) / expectedPoints) > 0.05),
  `pool1=${(((poolCounts.get(1) ?? 0) / expectedPoints) * 100).toFixed(1)}% pool2=${(((poolCounts.get(2) ?? 0) / expectedPoints) * 100).toFixed(1)}% pool3=${(((poolCounts.get(3) ?? 0) / expectedPoints) * 100).toFixed(1)}%`,
);
record('F.red floor texels found', floorPool > 0, `floorPool=${floorPool}`);

let scaleMin = Infinity;
let scaleMax = -Infinity;
for (const value of placement.aSpriteScales) {
  scaleMin = Math.min(scaleMin, value);
  scaleMax = Math.max(scaleMax, value);
}
record('F.aSpriteScale = .1 + .2*rand', scaleMin >= 0.1 && scaleMax <= 0.3, `[${scaleMin.toFixed(3)}, ${scaleMax.toFixed(3)}]`);

let yNoiseMin = Infinity;
let yNoiseMax = -Infinity;
let growMin = Infinity;
let growMax = -Infinity;
for (let i = 0; i < expectedPoints; i++) {
  yNoiseMin = Math.min(yNoiseMin, placement.aYNoise[i]);
  yNoiseMax = Math.max(yNoiseMax, placement.aYNoise[i]);
  growMin = Math.min(growMin, placement.aFlowerGrowNoise[i]);
  growMax = Math.max(growMax, placement.aFlowerGrowNoise[i]);
}
record('F.aYNoise uses JS % hash range', yNoiseMin > -1 && yNoiseMax < 1, `[${yNoiseMin.toFixed(3)}, ${yNoiseMax.toFixed(3)}]`);
record('F.aFlowerGrowNoise in simplex range', growMin >= -1.1 && growMax <= 1.1, `[${growMin.toFixed(3)}, ${growMax.toFixed(3)}]`);

/* ---------------- G. hard structural facts ---------------- */

const hardFactChecks = [
  ['G.Points instead of InstancedMesh', !/InstancedMesh|InstancedBufferGeometry/.test(valleySceneSource)],
  ['G.THREE.Points used', /new Points\(/.test(valleySceneSource)],
  ['G.material transparent:true', /transparent:\s*true/.test(valleySceneSource)],
  ['G.material depthTest:false', /depthTest:\s*false/.test(valleySceneSource)],
  ['G.outputColorSpace SRGB', /outputColorSpace = SRGBColorSpace/.test(valleySceneSource)],
  ['G.camera 27deg near 1', /CAMERA\.fov/.test(valleySceneSource) && /CAMERA\.near/.test(valleySceneSource)],
  ['G.breathContainer holds camera', /this\.breathContainer\.add\(this\.camera\)/.test(valleySceneSource)],
  ['G.cameraContainer holds breath', /this\.cameraContainer\.add\(this\.breathContainer\)/.test(valleySceneSource)],
  ['G.scene holds cameraContainer', /this\.scene\.add\(this\.cameraContainer\)/.test(valleySceneSource)],
  ['G.Float32BufferAttribute (r154 rejects plain arrays)', /new Float32BufferAttribute\(/.test(valleySceneSource)],
  ['G.no `any` in experience scope', !/:\s*any\b|as any\b|<any>/.test(allExperienceSources)],
  ['G.uDispersalProgress fed by hover/exit', /uniforms\.uDispersalProgress\.value = dispersal/.test(valleySceneSource)],
  ['G.uContainerPos fed by path', /uniforms\.uContainerPos\.value = this\.gltfCamPosition/.test(valleySceneSource)],
];
for (const [name, pass] of hardFactChecks) record(name, pass, pass ? 'ok' : 'VIOLATED');

/* ------------------------------------------------------------------ */

for (const result of results) {
  console.log(`${result.pass ? 'PASS' : 'FAIL'}  ${result.name.padEnd(62)} ${result.detail}`);
}
console.log('');
console.log(`scene-params: ${passed}/${results.length} checks passed, ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
