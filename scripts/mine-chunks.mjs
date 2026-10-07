import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = 'evidence/source-assets';
const files = [];
function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.js') || p.endsWith('.css')) files.push(p);
  }
}
walk(root);

const PATTERNS = [
  /\/valley\/[A-Za-z0-9_\-./]*/g,
  /[\w./-]+\.(?:glb|gltf|hdr|exr|ktx2|basis|mp4|webm)/g,
  /FlowerValley[A-Za-z_]*/g,
  /three\.js r\d+/g,
  /InstancedMesh|instanceMatrix|instanceColor/g,
  /FogExp2|Fog\b/g,
  /DepthOfField|EffectComposer|UnrealBloom|BokehPass|RenderPass|ShaderPass/g,
  /ScrollTrigger|gsap|CustomEase|SplitText|ScrollTo/g,
  /lenis|Lenis/g,
  /ShaderMaterial|onBeforeCompile|glsl|varying |uniform /g,
  /pool_summer|pool_winter|vignette|dust-particle|terrain|ray\d/g,
  /colorSpace|SRGBColorSpace|ACESFilmic|toneMapping|outputColorSpace/g,
  /prefers-reduced-motion|matchMedia/g,
  /wheel|deltaY|touchmove/g,
  /pointermove|mousemove/g,
  /season|winter|summer|spring|autumn|bloom|morph/g,
  /--theme-[a-z-]+/g,
  /t-hero|Header-height|px-sms|duration-theme|z-main|z-Header/g,
  /font-family|@font-face|Söhne|soehne|epicene|Epicene/g,
  /letter-spacing|line-height|font-size|font-weight/g,
];

const lines = [];
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  lines.push(`\n########## ${f} (${src.length} chars) ##########`);
  for (const re of PATTERNS) {
    re.lastIndex = 0;
    const hits = [];
    let m;
    while ((m = re.exec(src)) && hits.length < 40) {
      const start = Math.max(0, m.index - 90);
      hits.push(src.slice(start, Math.min(src.length, m.index + 210)).replace(/\s+/g, ' '));
    }
    if (hits.length) {
      lines.push(`--- [${re.source}] ${hits.length} hits ---`);
      hits.forEach((h, i) => lines.push(`  ${i}: ${h}`));
    }
  }
}
const out = lines.join('\n');
writeFileSync('evidence/js-mine.txt', out);
console.log('files scanned:', files.length, 'report chars:', out.length);
