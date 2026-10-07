const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const APP_ROOT = path.resolve(__dirname, '..');
const componentPath = path.join(APP_ROOT, 'src/components/work/FeaturedWorkGrid.tsx');
const resolverPath = path.join(APP_ROOT, 'src/components/work/featured-video-source.ts');

// Compile the real modules in memory with the existing TypeScript dependency.
// Relative TypeScript imports and React/Next imports execute their real modules;
// no renderer, DOM, network, browser, dependency install or build output is needed.
function loadTypeScript(filename, cache = new Map()) {
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = new Module(filename);
  module.paths = Module._nodeModulePaths(path.dirname(filename));
  cache.set(filename, module);
  const localRequire = Module.createRequire(filename);
  module.require = (specifier) => {
    if (specifier.startsWith('.')) {
      for (const extension of ['.ts', '.tsx']) {
        const target = path.resolve(path.dirname(filename), specifier) + extension;
        if (fs.existsSync(target)) return loadTypeScript(target, cache);
      }
    }
    return localRequire(specifier);
  };
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
    reportDiagnostics: true,
  });
  assert.equal((compiled.diagnostics || []).length, 0);
  module._compile(compiled.outputText, filename);
  return module.exports;
}

const { cardLayers } = loadTypeScript(componentPath);
const projects = JSON.parse(fs.readFileSync(path.join(APP_ROOT, 'src/content/projects.json'), 'utf8'));

// Fixed, sanitized expectations from the approved five-file MAPPING.json.
const candidates = [
  ['the-dj-and-the-war-crimes', '855535768', 2, 1, 13845870, '7c32f0855b962238251a04f0e3149b9aaa22521e3dc4bc14a06b12e7fe8d3516'],
  ['hypercinema', '882705368', 3, 0, 6199402, '33a608e474f7ff8dd9686c652abe1f6367c2166bb73d6740876b357b9f5a9147'],
  ['cyberbrokers', '894381115', 4, 0, 8978384, 'c99825ce671e10806e9e8aa0e028ed8504d89a1f67414a0daaf8f30b052c25ca'],
  ['the-examination', '865174986', 5, 1, 6857660, '5b5aacaa6af6184d9ba5fe374e0f09136e522f1656e562baea7b15e69cd09da9'],
  ['social-mobility-in-the-digital-age', '894383301', 6, 0, 11613241, 'c54e4c9f21cc0dd3cbed4005fed09685be84a4c5a6bac2f0514be9da60cd219a'],
].map(([slug, id, cardIndex, layerIndex, bytes, sha256]) => ({
  slug, id, cardIndex, layerIndex, bytes, sha256,
  localSource: `/sites/gladeye/work/${slug}/video/featured-${id}.mp4`,
}));
const syntheticSource = (id) => `https://player.vimeo.com/progressive_redirect/playback/${id}/rendition/1080p/file.mp4`;
const resolver = () => loadTypeScript(resolverPath).resolveFeaturedVideoSource;
const originalVideoSource = (card, layerIndex) => layerIndex === 0
  ? card.raw.thumbnail_video
  : card.raw.thumbnails_multimedia[layerIndex - 1].source;

for (const [label, layerIndex] of [['raw thumbnail_video', 0], ['raw multimedia video', 1]]) {
  test(`${label} branch resolves the real Featured records to local MP4s`, () => {
    for (const candidate of candidates.filter((entry) => entry.layerIndex === layerIndex)) {
      const card = projects.featured[candidate.cardIndex];
      assert.equal(card.slug, candidate.slug);
      const layer = cardLayers(card)[layerIndex];
      assert.equal(layer.kind, 'video');
      // Avoid exposing a historical signed URL if a RED assertion fails.
      assert.equal(layer.source === candidate.localSource, true, `${candidate.slug}: local source missing`);
      assert.equal(layer.vimeoId, candidate.id);
    }
  });
}

test('all five identities resolve independently of synthetic query and fragment variations', () => {
  const resolve = resolver();
  assert.equal(candidates.length, 5);
  assert.equal(new Set(candidates.map((entry) => `${entry.slug}:${entry.id}`)).size, 5);
  assert.equal(new Set(candidates.map((entry) => entry.localSource)).size, 5);
  for (const { slug, id, localSource } of candidates) {
    for (const suffix of ['', '?fixture=one', '#fixture', '?fixture=two#other']) {
      assert.equal(resolve(slug, syntheticSource(id) + suffix), localSource);
    }
    assert.equal(resolve(slug, localSource), localSource);
  }
});

test('cross-project swaps never resolve, including Work versus Ventures HyperCinema', () => {
  const resolve = resolver();
  for (const candidate of candidates) {
    for (const other of candidates.filter((entry) => entry.slug !== candidate.slug)) {
      const source = syntheticSource(other.id);
      assert.equal(resolve(candidate.slug, source), source);
    }
    for (const slug of ['', 'unknown-project', candidate.slug.toUpperCase(), `${candidate.slug}/other`]) {
      const source = syntheticSource(candidate.id);
      assert.equal(resolve(slug, source), source);
    }
  }
  for (const id of ['859216173', '879597010', '1221018160', '1096787331', '1068693417', '1068684498', '123456789']) {
    const source = syntheticSource(id);
    assert.equal(resolve('hypercinema', source), source);
  }
});

test('canonical host and complete progressive path reject spoofing and unsupported identities', () => {
  const resolve = resolver();
  for (const { slug, id } of candidates) {
    const eligible = syntheticSource(id);
    const sources = [
      eligible.replace('player.vimeo.com', 'example.test'),
      eligible.replace('player.vimeo.com', 'player.vimeo.com.example.test'),
      eligible.replace('player.vimeo.com', 'example.test/player.vimeo.com'),
      eligible.replace('player.vimeo.com', 'player.vimeo.com@example.test'),
      eligible.replace('player.vimeo.com', 'viewer@player.vimeo.com'),
      eligible.replace('player.vimeo.com', 'player.vimeo.com:444'),
      eligible.replace('player.vimeo.com', 'player.vimeo.com:443'),
      eligible.replace('player.vimeo.com', 'player.vimeo.com.'),
      eligible.replace('https:', 'http:'),
      eligible.replace('https:', ''),
      eligible.replace('/progressive_redirect/', '/other/'),
      eligible.replace('/progressive_redirect/', '/other/../progressive_redirect/'),
      eligible.replace('/playback/', '/playback//'),
      eligible.replace(id, `0${id}`),
      eligible.replace(id, `${id}0`),
      eligible.replace(id, `%38${id.slice(1)}`),
      eligible.replace('/1080p/', '/720p/'),
      eligible.replace('/file.mp4', '/file.mp4/extra'),
      eligible.replace('/file.mp4', '/file.mp4.exe'),
      `https://player.vimeo.com/video/${id}`,
      `https://vimeo.com/${id}`,
      `https://example.test/preview?source=${eligible}`,
      ` ${eligible}`,
      `${eligible}\n`,
      `${eligible}?fixture=yes\n`,
      '', null, undefined,
    ];
    for (const source of sources) assert.equal(resolve(slug, source), source);
  }
});

const baselineLayers = [
  ['where-opportunity-takes-root', [
    ['image', '2476x1886-b64705241d-walton-thumbnail.jpg', 'Gladeye', 2476, 1886], ['video', '1221018160'],
  ]],
  ['into-the-amazon', [
    ['video', '1096787331'], ['image', '2476x1755-0a6a3e5858-gladeye-into-the-amazon-national-geographic-1.jpg', 'Gladeye', 2476, 1755],
  ]],
  ['the-dj-and-the-war-crimes', [
    ['image', '3508x2480-b960f86fb1-rs-1.jpg', 'Gladeye', 3508, 2480], ['video', '855535768'],
  ]],
  ['hypercinema', [
    ['video', '882705368'], ['image', '1656x1656-b48380362c-hc-behindthescenes2.jpg', 'Gladeye', 1656, 1656],
  ]],
  ['cyberbrokers', [
    ['video', '894381115'], ['image', '5068x3380-0397cf2507-cyberbrokers-art2.jpg', 'Screenshot of Cyber Brokers website', 5068, 3380],
  ]],
  ['the-examination', [
    ['image', '2560x1760-16c6850e86-gladeye-the-examination-default.png', 'Gladeye', 2560, 1760], ['video', '865174986'],
  ]],
  ['social-mobility-in-the-digital-age', [
    ['video', '894383301'], ['image', '5118x2880-ea8c048fe9-cover-falling.jpg', 'Person falling in mid air to the ground with a ladder falling above them', 5118, 2880],
  ]],
  ['eqty-lab-website', [['video', '1068693417'], ['video', '1068684498']]],
];

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

test('real cardLayers preserves all eight cards, two-layer order, images, IDs and noncandidate sources', () => {
  const cards = deepFreeze(structuredClone(projects.featured));
  const before = JSON.stringify(cards);
  const actual = cards.map((card) => [card.slug, cardLayers(card).map((layer, layerIndex) => {
    if (layer.kind === 'image') {
      return ['image', layer.src.slice(`/sites/gladeye/work/${card.slug}/`.length), layer.alt, layer.naturalWidth, layer.naturalHeight];
    }
    const match = candidates.find((entry) => entry.slug === card.slug && entry.layerIndex === layerIndex);
    const expectedSource = match ? match.localSource : originalVideoSource(card, layerIndex);
    assert.equal(layer.source === expectedSource, true, `${card.slug} layer ${layerIndex}: unexpected source`);
    return ['video', layer.vimeoId];
  })]);
  assert.deepEqual(actual, baselineLayers);
  assert.equal(JSON.stringify(cards) === before, true);
});

test('a conflicting raw source cannot be overridden by normalized card Vimeo metadata', () => {
  const candidate = candidates[1];
  const card = structuredClone(projects.featured[candidate.cardIndex]);
  card.raw.thumbnail_video = syntheticSource('859216173');
  const layer = cardLayers(card)[0];
  assert.equal(layer.source, card.raw.thumbnail_video);
  assert.equal(layer.vimeoId, '859216173');
});

test('the resolver is a small, unimported five-record pure module with no private source URLs', () => {
  const text = fs.readFileSync(resolverPath, 'utf8');
  const ast = ts.createSourceFile(resolverPath, text, ts.ScriptTarget.Latest, true);
  const records = [];
  const walk = (node) => {
    assert.equal(ts.isImportDeclaration(node), false);
    assert.equal(ts.isNewExpression(node), false);
    if (ts.isIdentifier(node)) assert.doesNotMatch(node.text, /^(fetch|XMLHttpRequest|window|document|process|require)$/);
    if (ts.isObjectLiteralExpression(node)) records.push(node.properties.map((entry) => entry.initializer.text));
    ts.forEachChild(node, walk);
  };
  walk(ast);
  assert.deepEqual(records, candidates.map(({ slug, id, localSource }) => [slug, id, localSource]));
  assert.doesNotMatch(text, /(?:\?h=|signature|expires|\.json|video-manifest|https:\/\/)/);
  const resolve = resolver();
  for (let repeat = 0; repeat < 3; repeat++) {
    for (const { slug, id, localSource } of candidates) assert.equal(resolve(slug, syntheticSource(id)), localSource);
  }
});

test('the five existing MP4s retain exact contract bytes, SHA-256 and ftyp integrity', () => {
  let total = 0;
  for (const { localSource, bytes, sha256 } of candidates) {
    const filename = path.join(APP_ROOT, 'public', localSource);
    const data = fs.readFileSync(filename);
    assert.equal(data.length, bytes, localSource);
    assert.equal(data.toString('ascii', 4, 8), 'ftyp', localSource);
    assert.equal(createHash('sha256').update(data).digest('hex'), sha256, localSource);
    total += data.length;
  }
  assert.equal(total, 47494557);
});
