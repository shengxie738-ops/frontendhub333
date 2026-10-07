# V1 Home render-failure milestone

## Bounded outcome

Home now validates the existing synchronous valley-scene programs before publishing ready or starting its owner loop. Credible Three shader errors and compile exceptions end in failed/poster with shader-compile-failed; caught frame, clock, and RAF scheduling exceptions end with renderer-crashed. Acquired owners are released through the existing idempotent cleanup chain. Callbacks that destroy the owner cannot continue rendering, publishing diagnostics, or scheduling frames. Warning-only and unrelated console output remain nonfatal.

The R1 whole-load deadline and R2/R3 ownership behavior are retained. No shared diagnostic types, shader sources, camera data, motion/math formulas, visual parameters, assets, dependencies, or global styles changed.

## Verification

The two-file candidate received an independent narrow review and a same-reviewer final-hash approval. Fresh main-tree verification uses exactly nine specified script files: 171/171 regression tests (139 prior plus 32 new), 226/226 static scene checks, TypeScript with incremental disabled, and lint. Six pre-existing source warnings remain.

The isolated final candidate production build generated 51/51 pages. It is referenced only after comparing every non-generated application input and confirming the installed dependency root is identical. No new main-tree production build is claimed when that equality holds.

Frozen candidate diff SHA-256: 786074cf58bff6e81d4f154416c573b23e614e847dfcd44a50d154875779d597.

## Acceptance limits

The lifecycle tests run production TypeScript and real Three CPU objects with mocked renderer, network, terrain, and post-processing boundaries. They do not establish real browser/WebGL/GPU, composer-only shader-pass, context loss/restoration, hidden-tab, quality-rebuild, resource/performance, or visual acceptance. A successful build and static parameter checks are not GPU or visual evidence. Media redistribution/deployment rights also remain unverified.

This milestone publishes only ValleyScene.ts, the focused home-render-failure regression file, and this authored summary. It includes no research logs, screenshots, media, raw source captures, or signed URLs. No PR, merge, or deployment is part of this stage.
