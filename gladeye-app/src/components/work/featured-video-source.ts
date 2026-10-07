/** Only the five evidenced Work Featured sources, never case or Ventures media. */
const featuredVideoSources: readonly {
  readonly slug: string;
  readonly vimeoId: string;
  readonly localSource: string;
}[] = [
  {
    slug: 'the-dj-and-the-war-crimes',
    vimeoId: '855535768',
    localSource: '/sites/gladeye/work/the-dj-and-the-war-crimes/video/featured-855535768.mp4',
  },
  {
    slug: 'hypercinema',
    vimeoId: '882705368',
    localSource: '/sites/gladeye/work/hypercinema/video/featured-882705368.mp4',
  },
  {
    slug: 'cyberbrokers',
    vimeoId: '894381115',
    localSource: '/sites/gladeye/work/cyberbrokers/video/featured-894381115.mp4',
  },
  {
    slug: 'the-examination',
    vimeoId: '865174986',
    localSource: '/sites/gladeye/work/the-examination/video/featured-865174986.mp4',
  },
  {
    slug: 'social-mobility-in-the-digital-age',
    vimeoId: '894383301',
    localSource: '/sites/gladeye/work/social-mobility-in-the-digital-age/video/featured-894383301.mp4',
  },
];

export function resolveFeaturedVideoSource(slug: string, source: string): string;
export function resolveFeaturedVideoSource(slug: string, source: null | undefined): null | undefined;
export function resolveFeaturedVideoSource(slug: string, source: string | null | undefined): string | null | undefined {
  if (typeof source !== 'string') return source;

  // Match the observed canonical authority/path, without URL normalization or
  // substring matching. Queries/fragments carry no playback identity.
  const match = /^https:\/\/player\.vimeo\.com\/progressive_redirect\/playback\/(\d+)\/rendition\/1080p\/file\.mp4(?:[?#][^\r\n]*)?$/.exec(source);
  if (!match || match[0] !== source) return source;

  return featuredVideoSources.find((entry) => entry.slug === slug && entry.vimeoId === match[1])?.localSource ?? source;
}
