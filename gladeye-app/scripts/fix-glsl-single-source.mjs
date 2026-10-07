import { readFileSync, writeFileSync, rmSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// Single-source GLSL: the verbatim .glsl files are the runtime input.
// The .glsl.ts twins were a stopgap that silently went unused once the real
// .glsl files landed, and having both makes webpack and tsc disagree.
writeFileSync(
  'next.config.mjs',
  `/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.module.rules.push({ test: /\\.glsl$/, type: 'asset/source' });
    return config;
  },
};

export default nextConfig;
`,
);

mkdirSync('src/types', { recursive: true });
writeFileSync(
  'src/types/glsl.d.ts',
  "declare module '*.glsl' {\n  const source: string;\n  export default source;\n}\n",
);

const dir = 'src/experience/glsl';
for (const f of readdirSync(dir).filter((n) => n.endsWith('.glsl.ts'))) rmSync(join(dir, f));

const p = join(dir, 'index.ts');
let s = readFileSync(p, 'utf8');
s = s.replace(/import \{ (\w+) \} from '(\.\/[\w.-]+?)\.glsl';/g, 'import $1 from $2.glsl;');
writeFileSync(p, s);

const named = (s.match(/import \{/g) || []).length;
const dflt = (s.match(/^import \w+ from/gm) || []).length;
console.log(`twins removed; index.ts default-imports=${dflt} named-imports=${named}`);
