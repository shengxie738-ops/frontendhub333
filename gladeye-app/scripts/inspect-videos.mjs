import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(d, out = []) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (p.endsWith('.mp4')) out.push(p);
  }
  return out;
}

const files = walk(process.argv[2] || 'public');
let bad = 0;
for (const f of files) {
  const b = readFileSync(f);
  const magic = b.subarray(4, 12).toString('latin1');
  const isMp4 = magic.includes('ftyp');
  const size = statSync(f).size;
  if (!isMp4) {
    bad++;
    const text = b.subarray(0, 260).toString('utf8').replace(/\s+/g, ' ');
    console.log(`BAD   ${(size / 1048576).toFixed(2)}MB  ${f}`);
    console.log(`      first bytes: ${b.subarray(0, 16).toString('hex')}`);
    console.log(`      as text    : ${text.slice(0, 220)}`);
  } else {
    console.log(`OK    ${(size / 1048576).toFixed(2)}MB  ${f}`);
  }
}
console.log(`\nvideos: ${files.length}, non-mp4: ${bad}`);
