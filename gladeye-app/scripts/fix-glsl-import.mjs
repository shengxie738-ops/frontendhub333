import { readFileSync, writeFileSync, rmSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// 1. Webpack: import *.glsl as raw text so the verbatim shader files are the
//    single runtime source (no hand-maintained .ts twin that can drift).
const cfg = `/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.module.rules.push({
      test: /\\.glsl$/,
      type: 'asset/source',
    });
    return config;
  },
};

export default nextConfig;
`;
writeFileSync('next.config.mjs', cfg);
console.log('next.config.mjs: added .glsl raw rule');

mkdirSync('src/types', { recursive: true });
writeFileSync(
  'src/types/glsl.d.ts',
  'declare module \'*.glsl\' {\n  const source: string;\n  export default source;\n}\n',
);
console.log('src/types/glsl.d.ts written');

// 2. index.ts: named imports of the .ts twin -> default import of the real file
const idxPath = 'src/experience/glsl/index.ts';
let idx = readFileSync(idxPath, 'utf8');
idx = idx.replace(
  /import \{ (\w+) \} from '\.\/([\w.-]+?)\.glsl';/g,
  (_m, name, file) => `import ${name} from './${file}.glsl';`,
);
idx = idx.replace(
  /Every entry is the \*verbatim\* original shader string extracted from the live\n \* gladeye\.com bundle \(`evidence\/source-assets\/js\/\.\.\.`\), copied into\n \* `src\/experience\/glsl\/<name>\.glsl` and re-exported byte-identically from the\n \* generated `<name>\.glsl\.ts` twin \(see `scripts\/verify-scene-params\.mjs`,\n \* which asserts the two copies never drift\)\./,
  'Every entry is the *verbatim* original shader string extracted from the live\n * gladeye.com bundle (`evidence/source-assets/js/...`), kept in\n * `src/experience/glsl/<name>.glsl` and imported as raw text by webpack\n * (next.config.mjs). `scripts/verify-scene-params.mjs` asserts each file is\n * still byte-identical to its counterpart in `evidence/shaders/`.',
);
writeFileSync(idxPath, idx);
console.log('index.ts rewritten to default-import .glsl');

// 3. Drop the now-redundant twins
const dir = 'src/experience/glsl';
const removed = readdirSync(dir).filter((f) => f.endsWith('.glsl.ts'));
for (const f of removed) rmSync(join(dir, f));
console.log('removed twins:', removed.length);
