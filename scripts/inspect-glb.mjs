import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2];
const buf = readFileSync(file);
const magic = buf.readUInt32LE(0);
const version = buf.readUInt32LE(4);
const length = buf.readUInt32LE(8);
let off = 12;
let json = null;
let binLength = 0;
const chunks = [];
while (off < buf.length) {
  const clen = buf.readUInt32LE(off);
  const ctype = buf.subarray(off + 4, off + 8).toString('ascii');
  const data = buf.subarray(off + 8, off + 8 + clen);
  chunks.push({ ctype, clen });
  if (ctype === 'JSON') json = JSON.parse(data.toString('utf8'));
  if (ctype === 'BIN') { binLength = clen; writeFileSync(file + '.bin', data); }
  off += 8 + clen;
}
const summary = {
  file,
  header: { magic, version, length },
  chunks,
  binLength,
  json,
};
writeFileSync(file + '.json', JSON.stringify(summary, null, 1));

const accessors = json.accessors || [];
const print = [];
print.push(`asset=${JSON.stringify(json.asset)} scene=${JSON.stringify(json.scene)}`);
(json.nodes || []).forEach((n, i) => {
  print.push(`node[${i}] ${n.name || ''} translation=${JSON.stringify(n.translation)} rotation=${JSON.stringify(n.rotation)} scale=${JSON.stringify(n.scale)} mesh=${n.mesh} children=${JSON.stringify(n.children)}`);
});
(json.meshes || []).forEach((m, i) => {
  print.push(`mesh[${i}] ${m.name || ''} prims=${m.primitives.length} attrs=${JSON.stringify(Object.values(m.primitives[0].attributes))}`);
});
(json.animations || []).forEach((a, i) => {
  print.push(`anim[${i}] ${a.name || ''} channels=${a.channels.length}`);
  a.channels.forEach((ch) => {
    print.push(`  ch target.node=${ch.target.node} path=${ch.target.path} sampler=${ch.sampler}`);
  });
  (a.samplers || []).forEach((s, si) => {
    const ip = accessors[s.input];
    const op = accessors[s.output];
    print.push(`  sampler[${si}] interpolation=${s.interpolation} input(count=${ip?.count} type=${ip?.type} min=${JSON.stringify(ip?.min)} max=${JSON.stringify(ip?.max)}) output(count=${op?.count} type=${op?.type} min=${JSON.stringify(op?.min)} max=${JSON.stringify(op?.max)})`);
  });
});
print.push(`buffers=${JSON.stringify(json.buffers)} bufferViews=${(json.bufferViews||[]).length} accessors=${accessors.length}`);
print.push(`cameras=${JSON.stringify(json.cameras)} skins=${JSON.stringify(json.skins)} materials=${JSON.stringify((json.materials||[]).map(m=>m.name))}`);
writeFileSync(file + '.report.txt', print.join('\n'));
console.log(print.join('\n'));
