# V1: Featured media and Home owner lifecycles

Bounded integration on base `f8c8c215fb1dc0a157245adf6ea3f321b39735ac`, dated 2026-10-07 UTC.

## Included changes

- The five previously resolved local Featured video identities retain persistent muted, looping, inline video nodes. Preparation, actual-layer readiness, and playback permission are independent. Hover can wait for readiness; leave/re-hover preserves playback time. Offscreen, hidden-page, inactive, reduced-motion and unmounted players pause. Stale play completions cannot revive revoked playback or invalidate a newer activation.
- Home recovery is limited to R2/R3 owner boundaries: late texture/load completions cannot revive disposed owners; external progress/frame callbacks cannot schedule owner work after destruction; partial construction rolls back acquired Home/Scene resources; cleanup attempts continue for other acquired owners when one release throws. Original initialization exceptions are preserved.
- Publication contains five reviewed source/test files and this authored milestone. Assets, dependencies, scene parameters, shared motion/scroll/post-FX, global styles and unrelated work are unchanged by this commit.

## Source observations and product policy

The supplied source measurements deeply observe only the DJ card's hover/leave/re-hover flow: a ready, persistent muted video, image restored on settled leave, paused with time retained, and resumed on re-hover. Other default-video observations support visible playback and offscreen pause; deep hover/readiness parity for the other four videos remains unmeasured. Exact event latency and network strategy were not established.

The 200px near-preparation margin, 1% viewport playback threshold, readyState >= 3 gate, page/reduced-motion behavior, lazy local-source attachment, same-card static-image fallback and terminal mounted-player failures are explicit product policies. They are not newly measured source settings. Already prepared requests may continue; no request-cancellation or zero-offscreen-bytes claim is made.

## Integration verification

Final combined-tree checks, run in the cloud on 2026-10-07 UTC:

- Explicit seven-file Node regression command: 120/120 passed (63 existing + 30 Featured + 27 Home); no failed, skipped or cancelled tests
- Scene-parameter verifier: 226/226 passed
- TypeScript: no diagnostics, exit 0
- Lint: exit 0; six existing warnings retained, rules unchanged
- Exclusive production build: exit 0; 51/51 static pages generated

Only the seven named app/scripts suites were selected: header-menu, contact-footer-lifecycle, contact-fidelity, verify-scene-params, featured-video-source, featured-video-lifecycle and home-recovery. No broad test discovery, browser, server, download or unsafe flag was used. These local checks are distinct from any GitHub CI result.

Each package had an independent code review. The Featured review closed two observer findings and independently reran 30 lifecycle tests. The Home review found two P1 owner-boundary issues; the same reviewer confirmed both corrections with six focused tests and final hash matching. Controlled React/jsdom and CPU/mock-GPU fixtures prove the bounded state/ownership contracts, not browser playback or real graphics behavior.

## Acceptance still pending

- Real browser decode/autoplay, all-five playback, HTTP Content-Type/Range, first frame and crop
- Real WebGL rendering, resource behavior and native navigation/teardown
- Source-to-local visual comparison at all four CSS viewports
- Loading deadlines, shader/frame failure states, context loss/restoration, hidden-tab Home policy and quality rebuild ownership
- Unreturned resources inside third-party/shared constructors and partially throwing cleanup internals
- Media redistribution/deployment rights

No full-fidelity, deadline, shader or context-recovery claim is made. This stage creates no PR or deployment.
