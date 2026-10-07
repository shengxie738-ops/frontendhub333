# V1 milestone: five existing Featured video sources

Base: `986fdc3f7d581b4f75edf911171b8a4f3e8a49fa`.

This bounded Slice A connects the five already-present Work Featured MP4s to their exact local paths. The pure resolver requires both the project slug and the original Vimeo progressive-source ID, preserving unknown or mismatched sources. FeaturedWorkGrid uses it only in its two video-layer source expressions. Layer order, image details and original Vimeo metadata remain unchanged. Case, archive, showreel and Ventures consumers are outside this slice.

Publication contains only the resolver, its two component connections, the independent Node regression file and this authored milestone note. No media, research captures, raw source bundles or signed media URLs are added.

## Verified integration

On Node 24.19.0 / npm 11.9.0, the integrated latest V1 passed:

- Explicit serial regression suite: 63/63 tests, zero failures
- Real scene verifier: 226/226 checks
- TypeScript and lint: exit 0; six pre-existing lint warnings remain
- Exclusive production build: exit 0, 51/51 static pages
- Independent candidate review: mapping and scope GO, no required fixes

From `gladeye-app/`:

```sh
node --test --test-concurrency=1 scripts/header-menu.test.cjs scripts/contact-fidelity.test.mjs scripts/contact-footer-lifecycle.test.cjs scripts/verify-scene-params.test.mjs scripts/featured-video-source.test.cjs
node scripts/verify-scene-params.mjs
./node_modules/.bin/tsc --noEmit
npm run lint
npm run build
```

## Acceptance pending

This is only five-source identity wiring. Hover/readiness, pause/resume, browser decoding/autoplay, HTTP Range behavior, all-five playback, first-frame/crop and four-viewport visual comparison remain unaccepted. Media redistribution/deployment rights remain unverified. No browser, deployment or CI pass is claimed.
