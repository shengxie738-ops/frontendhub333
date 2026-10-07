import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const root = 'evidence/source-assets/js';
const outDir = 'evidence/shaders';
mkdirSync(outDir, { recursive: true });
mkdirSync('evidence/params', { recursive: true });

const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.js')) files.push(p);
  }
})(root);

// Scans a JS double-quoted string literal starting at index of the opening quote.
function readStringLiteral(src, i) {
  // src[i] must be '"'
  let j = i + 1;
  let out = '';
  const MAP = { n: '\n', t: '\t', r: '\r', '"': '"', "'": "'", '\\': '\\', '0': '\0' };
  while (j < src.length) {
    const ch = src[j];
    if (ch === '\\') {
      const nx = src[j + 1];
      if (nx === 'u') { out += String.fromCharCode(parseInt(src.substr(j + 2, 4), 16)); j += 6; continue; }
      if (nx === 'x') { out += String.fromCharCode(parseInt(src.substr(j + 2, 2), 16)); j += 4; continue; }
      out += MAP[nx] === undefined ? nx : MAP[nx];
      j += 2;
      continue;
    }
    if (ch === '"') return { raw: out, end: j };
    out += ch;
    j++;
  }
  return null;
}

const GLSL_MARKERS = ['gl_Position', 'gl_FragColor', 'gl_PointCoord', 'precision highp', 'precision mediary', 'varying ', 'uniform sampler2D'];
const found = [];
const settingsWindows = [];
const functionWindows = [];

for (const f of files) {
  const src = readFileSync(f, 'utf8');
  // Module definitions like: 526:function(e){e.exports="....GLSL...."}
  const re = /(\d{2,5}):function\(([a-z])(?:,([a-z]))?\)\{\2\.exports="/g;
  let m;
  while ((m = re.exec(src))) {
    const quoteIdx = m.index + m[0].length - 1;
    const lit = readStringLiteral(src, quoteIdx);
    if (!lit) continue;
    const isGlsl = GLSL_MARKERS.some((k) => lit.raw.includes(k)) && lit.raw.length > 200 && !lit.raw.includes('__');
    if (isGlsl) {
      found.push({ file: f, moduleId: m[1], chars: lit.raw.length, code: lit.raw });
    }
  }
  for (const key of ['bloomParams:', 'uCamFar', 'dispersalAmountMultiplier', 'introCameraAngle', 'maxPixelRatio', 'pixelDensity', 'useBoostPerformance =', 'this.settings=']) {
    let idx = src.indexOf(key);
    let n = 0;
    while (idx !== -1 && n < 6) {
      settingsWindows.push({ file: f, key, at: idx, window: src.slice(Math.max(0, idx - 1200), idx + 1800) });
      idx = src.indexOf(key, idx + 1);
      n++;
    }
  }
  for (const key of ['function z(', 'aValleySide', 'aFlowerGrowNoise', 'noiseCoordinates', 'spriteSheet', 'getPool', 'uPoolRows', 'uSpriteSheetPool']) {
    let idx = src.indexOf(key);
    let n = 0;
    while (idx !== -1 && n < 4) {
      functionWindows.push({ file: f, key, at: idx, window: src.slice(Math.max(0, idx - 600), idx + 2400) });
      idx = src.indexOf(key, idx + 1);
      n++;
    }
  }
}

found.forEach((s, i) => {
  const header = `// Extracted verbatim from ${s.file} module ${s.moduleId} (${s.chars} chars)\n// Evidence: CONFIRMED-BUNDLE (original site GLSL source, minified bundle string literal)\n`;
  writeFileSync(join(outDir, `module-${s.moduleId}-${i}.glsl`), header + s.code);
});
writeFileSync('evidence/params/settings-windows.json', JSON.stringify(settingsWindows, null, 1));
writeFileSync('evidence/params/function-windows.json', JSON.stringify(functionWindows, null, 1));
console.log('shaders extracted:', found.length);
console.log(found.map((s) => `${s.moduleId}(${s.chars})`).join(' '));
console.log('settings windows:', settingsWindows.length, 'function windows:', functionWindows.length);
