/**
 * Local asset resolver for the /about, /contact and /careers images.
 *
 * The content JSON keeps the original absolute Storyblok URL verbatim (that is
 * the evidence). This helper reproduces the exact file-naming rule used by
 * `scripts/download-assets-gladeye-info.mjs`, so a URL resolves to the file
 * that script wrote under `public/sites/gladeye/<page>/`.
 *
 * Keeping the naming logic in two places is deliberate: the JSON stays a
 * faithful copy of the source payload instead of being rewritten to local paths.
 * If you change one, change the other, then re-run the downloader.
 */

export type InfoPage = 'about' | 'contact' | 'careers';

function splitAsset(url: string) {
  // https://a-us.storyblok.com/f/1014779/4032x3024/5077b19f33/img_0720.jpg
  const path = new URL(url).pathname;
  const parts = path.split('/').filter(Boolean);
  if (parts.length < 5) return null;
  const dims = parts[parts.length - 3];
  const hash = parts[parts.length - 2];
  const name = parts[parts.length - 1];
  const dot = name.lastIndexOf('.');
  const stem = dot === -1 ? name : name.slice(0, dot);
  const ext = dot === -1 ? '.jpg' : name.slice(dot);
  return { dims, hash, stem, ext };
}

/** `<hash>_<stem><ext>` lowercased and slug-safe — matches the downloader. */
export function localBase(url: string): string {
  const f = splitAsset(url);
  if (!f) return 'asset' + url.slice(-10);
  return (f.hash + '_' + f.stem).toLowerCase().replace(/[^a-z0-9._-]/g, '-') + f.ext.toLowerCase();
}

/** Full-resolution source asset, served from the repo. */
export function localSrc(page: InfoPage, url: string): string {
  return `/sites/gladeye/${page}/${localBase(url)}`;
}

/** The `/m/20x0` blur-up layer the original site paints underneath every image. */
export function localLqip(page: InfoPage, url: string): string {
  return `/sites/gladeye/${page}/${localBase(url).replace(/\.[^.]+$/, '')}.20x0.jpg`;
}

/** `<W>x<H>` from the asset path, for width/height hints and alt-free layouts. */
export function sourceDims(url: string): { width: number; height: number } | null {
  const f = splitAsset(url);
  if (!f) return null;
  const m = /^([0-9]+)x([0-9]+)$/.exec(f.dims);
  if (!m) return null;
  return { width: Number(m[1]), height: Number(m[2]) };
}
