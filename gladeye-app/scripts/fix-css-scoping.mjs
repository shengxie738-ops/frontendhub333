import { readFileSync, writeFileSync, rmSync } from 'node:fs';

const modPath = 'src/components/about/gladeye-info-tokens.module.css';
const globalPath = 'src/styles/info-tokens.css';
const src = readFileSync(modPath, 'utf8');

const gi = src.indexOf(':global');
const open = src.indexOf('{', gi);
let depth = 0;
let close = -1;
for (let k = open; k < src.length; k++) {
  if (src[k] === '{') depth++;
  else if (src[k] === '}') { depth--; if (depth === 0) { close = k; break; } }
}
if (close === -1) throw new Error('unbalanced :global block');

const head = src.slice(0, gi);
const body = src.slice(open + 1, close);
const tail = src.slice(close + 1).trim();
if (tail.length > 0) throw new Error(`unexpected content after :global block: ${tail.slice(0, 200)}`);

// de-indent one level so the file reads as ordinary global CSS
const dedented = body
  .split('\n')
  .map((l) => (l.startsWith('  ') ? l.slice(2) : l))
  .join('\n');

const preamble = head.replace(/\n:global\s*$/, '').trimEnd();
writeFileSync(
  globalPath,
  `${preamble}\n\n   (promoted from a CSS-Module :global block — this file declares\n    global theme variables, .t-* type tokens, .ui-* and .mq* helpers,\n    so it must not be scoped as a module.)\n * ================================================================== */\n${dedented.trimStart()}\n`,
);

rmSync(modPath);

for (const f of [
  'src/components/about/AboutPage.tsx',
  'src/components/careers/CareersPage.tsx',
  'src/components/contact/ContactPage.tsx',
]) {
  const t = readFileSync(f, 'utf8');
  const next = t.replace(/\nimport\s+['"]\.\/gladeye-info-tokens\.module\.css['"];?\n/g, '\n');
  if (next === t) throw new Error(`side-effect import not found in ${f}`);
  writeFileSync(f, next);
  console.log('stripped module import from', f);
}

// globals.css: pull in the promoted stylesheet
const g = readFileSync('src/app/globals.css', 'utf8');
if (!g.includes('info-tokens.css')) {
  writeFileSync('src/app/globals.css', g.replace('@import "../styles/components.css";', '@import "../styles/components.css";\n@import "../styles/info-tokens.css";'));
  console.log('added info-tokens import to globals.css');
}

console.log('global css chars:', readFileSync(globalPath, 'utf8').length);
