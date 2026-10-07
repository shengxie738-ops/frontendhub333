import { readFileSync, writeFileSync } from 'node:fs';

const glbPath = process.argv[2];
const outPath = process.argv[3];
const buf = readFileSync(glbPath);
let off = 12;
let json = null;
let bin = null;
while (off < buf.length) {
  const clen = buf.readUInt32LE(off);
  const ctype = [buf[off + 4], buf[off + 5], buf[off + 6], buf[off + 7]].filter(function (b) { return b !== 0; }).map(function (b) { return String.fromCharCode(b); }).join('');
  const data = buf.subarray(off + 8, off + 8 + clen);
  if (ctype === 'JSON') json = JSON.parse(data.toString('utf8'));
  if (ctype === 'BIN') bin = data;
  off += 8 + clen;
}

const BIN_AB = bin ? bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) : null;
const COMPONENT_TYPES = {
  5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array,
  5125: Uint32Array, 5126: Float32Array,
};
const NUM_COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function readAccessor(index) {
  const acc = json.accessors[index];
  const Ctor = COMPONENT_TYPES[acc.componentType];
  const n = NUM_COMPONENTS[acc.type];
  const bv = json.bufferViews[acc.bufferView];
  const byteOffset = (bv ? bv.byteOffset : 0) + (acc.byteOffset || 0);
  const arr = new Ctor(BIN_AB, byteOffset, acc.count * n);
  const out = [];
  for (let i = 0; i < acc.count; i++) {
    const row = [];
    for (let k = 0; k < n; k++) row.push(Number(arr[i * n + k].toFixed(6)));
    out.push(acc.type === 'SCALAR' ? row[0] : row);
  }
  return out;
}

const anim = json.animations[0];
const result = {
  meta: {
    source: glbPath,
    generator: json.asset.generator,
    note: 'Baked camera animation extracted verbatim from the original site asset.',
    camera: json.cameras[0],
    nodeRestRotation: json.nodes[0].rotation,
    keyframeCount: readAccessor(0).length,
    timeRange: [readAccessor(0)[0], readAccessor(0).at(-1)],
    fps: ((readAccessor(0).length - 1) / (readAccessor(0).at(-1) - readAccessor(0)[0])).toFixed(4),
  },
  times: readAccessor(0),
  channels: anim.channels.map((ch, i) => ({
    path: ch.target.path,
    interpolation: anim.samplers[ch.sampler].interpolation,
    values: readAccessor(anim.samplers[ch.sampler].output),
  })),
};
writeFileSync(outPath, JSON.stringify(result));
const t = result.times;
const tr = result.channels[0].values;
const ro = result.channels[1].values;
console.log(JSON.stringify(result.meta, null, 1));
console.log('translation first/last:', JSON.stringify(tr[0]), JSON.stringify(tr.at(-1)));
console.log('rotation first/last:', JSON.stringify(ro[0]), JSON.stringify(ro.at(-1)));
console.log('samples:', tr.length, 'bytes written:', readFileSync(outPath).length);
