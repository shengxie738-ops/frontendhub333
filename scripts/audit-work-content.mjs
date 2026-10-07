import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

// Independent content audit: does /work expose the same projects, in the same
// order, with the same covers as the frozen original page?
const BASE = process.env.BASE || 'http://127.0.0.1:3005';
const ref = JSON.parse(readFileSync('evidence/content/_work.json', 'utf8'));
const data = JSON.parse(readFileSync('gladeye-app/src/content/projects.json', 'utf8'));

const refTitles = ref.headings.map((h) => h.text.replace(/\s+/g, ' ').trim()).filter(Boolean);
const localHtml = execSync(`curl -s -m 120 "${BASE}/work"`, { maxBuffer: 1 << 28 }).toString();
const localTitles = [...localHtml.matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/g)]
  .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim())
  .filter(Boolean);

const slugSet = new Set([...(data.featuredOrder || []), ...(data.archiveOrder || [])]);
const refSlugs = new Set();
for (const l of ref.links || []) {
  const m = /^\/work\/([a-z0-9-]+)/.exec(l.href || '');
  if (m) refSlugs.add(m[1]);
}

console.log('--- projects.json ---');
console.log('featuredOrder:', (data.featuredOrder || []).length, 'archiveOrder:', (data.archiveOrder || []).length, 'projects:', Object.keys(data.projects || {}).length);
console.log('showreel present:', !!data.showreel, data.showreel ? JSON.stringify(data.showreel).slice(0, 160) : '');
console.log('tags:', Array.isArray(data.tags) ? data.tags.length : typeof data.tags);

console.log('\n--- slug coverage vs original /work links ---');
const missing = [...refSlugs].filter((s) => !slugSet.has(s));
const extra = [...slugSet].filter((s) => !refSlugs.has(s));
console.log('original slugs found in DOM:', refSlugs.size);
console.log('MISSING from our data:', missing.length, missing);
console.log('extra in our data:', extra.length, extra);

console.log('\n--- featured order parity ---');
console.log('ours  :', JSON.stringify((data.featuredOrder || []).slice(0, 8)));
const refFeatured = (ref.links || []).map((l) => (/^\/work\/([a-z0-9-]+)/.exec(l.href || '') || [])[1]).filter(Boolean);
const seen = [];
for (const s of refFeatured) if (!seen.includes(s)) seen.push(s);
console.log('orig  :', JSON.stringify(seen.slice(0, 8)), '(first-appearance order in original DOM)');

console.log('\n--- heading parity ---');
console.log('original headings:', refTitles.length, '| local headings:', localTitles.length);
const localSet = new Set(localTitles.map((t) => t.toLowerCase()));
const notRendered = refTitles.filter((t) => t.length > 3 && !localSet.has(t.toLowerCase()) && ![...localSet].some((lt) => lt.includes(t.toLowerCase().slice(0, 18))));
console.log('original headings NOT found locally:', notRendered.length);
notRendered.slice(0, 12).forEach((t) => console.log('   -', t.slice(0, 80)));

console.log('\n--- per-project content depth ---');
const rows = [];
for (const [slug, p] of Object.entries(data.projects || {})) {
  const blocks = p.blocks || p.content || [];
  const media = (p.media || []).length;
  rows.push({ slug, blocks: Array.isArray(blocks) ? blocks.length : 0, media, next: p.nextSlug || null, title: (p.title || '').slice(0, 34) });
}
rows.forEach((r) => console.log(`  ${r.slug.padEnd(38)} blocks=${String(r.blocks).padStart(3)} media=${String(r.media).padStart(3)} next=${(r.next || '-').padEnd(34)} ${r.title}`));
const thin = rows.filter((r) => r.blocks === 0 || r.media === 0);
console.log('\nTHIN projects (no blocks or no media):', thin.length, thin.map((t) => t.slug));
const dupNext = rows.filter((r) => r.next && !data.projects[r.next]);
console.log('nextSlug pointing at a missing project:', dupNext.length, dupNext.map((d) => `${d.slug}->${d.next}`));
const titles = rows.map((r) => r.title);
console.log('duplicate titles:', titles.length - new Set(titles).size);
