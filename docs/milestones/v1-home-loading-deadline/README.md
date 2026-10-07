# V1: bounded Home loading deadline

Stage dated 2026-10-07 UTC, on base `a265a02628b98f4477b596267000dd00c4eebf87`.

## Included behavior

One 30,000ms deadline covers the existing seven textures, terrain and scene preparation through readiness. The budget starts once; it does not reset between stages and adds no retry. This duration is an engineering resilience policy, not a measured source-site setting.

A timeout closes ownership before queued or late callbacks can run, leaves failed/poster/degraded diagnostics with the actual loading stage, and releases acquired scene and manager resources. Late textures are disposed without publishing ready or restarting RAF. Success, explicit failure and unload clear the timer. Cleanup exceptions preserve the timeout diagnosis and the remaining owner releases.

Publication is limited to ValleyScene.ts, its new 19-test deadline suite and this milestone. The independently reviewed frozen candidate is `116c540d5b8c0a52238bd69e9c37a9ab347e77368cabaab72c7f6d867da920f0`; the queued-final-texture attribution finding was corrected and independently rechecked.

## Verification

Fresh main-tree checks:

- Eight explicit Node suites: 139/139 passed, including the prior 120 plus 19 new deadline tests; no failures, skips or cancellations
- Scene-parameter verifier: 226/226 passed
- TypeScript: exit 0, no diagnostics; incremental output disabled
- Lint: exit 0; six existing warnings retained, rules unchanged

The isolated candidate production build generated 51/51 pages with exit 0. All 1,554 non-generated app files match the final main-tree inputs by path and SHA-256, including source, packages, lockfile, config and assets; both trees use the same installed dependencies. This stage references that verified build and did not run a new main-tree build.

Only header-menu, contact-fidelity, contact-footer-lifecycle, featured-video-source, featured-video-lifecycle, home-recovery, verify-scene-params and home-loading-deadline suites were selected. No broad discovery or legacy unsafe script was run. Local verification is separate from GitHub CI.

## Remaining acceptance

Controlled Node/VM tests run production scene TypeScript and real Three CPU resources with transport, renderer and related owners controlled. They do not establish browser, GPU, visual or performance acceptance. Timers cannot preempt synchronous JavaScript or guarantee exact wall-clock execution under browser throttling; existing transport has no new abort API.

Shader/compile/frame failures, context loss/restoration, hidden-tab and quality-rebuild behavior remain open. Real navigation, WebGL, four-viewport visual comparison and media rights are still pending. This stage creates no PR or deployment.
