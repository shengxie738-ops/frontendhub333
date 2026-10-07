# V1 milestone: header/menu and Contact lifecycle repairs

Base: `302294da348a0105ad664c2e4eabb5c89ce6e814`. This staged commit combines two independently reviewed r1 packages. It improves menu accessibility, focus/exit cancellation and section-theme ownership; restores the real footer observer across hidden/visible route transitions; and adds Contact marquee/data regressions with a pinned, app-local jsdom test dependency. Every existing non-root lockfile package entry is preserved.

## Verified scope

On Node 24.19.0 / npm 11.9.0, a base archive plus the exact 16 frozen package files passed:

- Explicit serial regression suite: 54/54 tests, zero failures (21 Header, 22 Contact, 7 lifecycle, 4 scene-verifier regressions)
- Real scene verifier: 226/226 checks
- TypeScript and lint: exit 0; six pre-existing lint warnings remain in unchanged files
- Shared exclusive production build: exit 0, 51/51 static pages; its frozen source/package context matches this candidate. This build was reused rather than repeated against shared `.next`.

From `gladeye-app/`, the verified commands are:

```sh
npm ci --legacy-peer-deps --ignore-scripts
node --test --test-concurrency=1 scripts/header-menu.test.cjs scripts/contact-fidelity.test.mjs scripts/contact-footer-lifecycle.test.cjs scripts/verify-scene-params.test.mjs
node scripts/verify-scene-params.mjs
./node_modules/.bin/tsc --noEmit
npm run lint
npm run build
```

Default `npm ci` retains an inherited limitation: both the original and candidate locks fail on missing pre-existing @emnapi/core and @emnapi/runtime peer entries with the tested npm version. The documented legacy-peer clean-install path and portable Header script were validated. Avoid broad Node test discovery: legacy browser scripts are separately gated.

## Acceptance pending

This is a behavior/lifecycle milestone, not final clone or visual acceptance. Actual browser routing/history, native focus/inert/scroll behavior, font/layout, marquee seams and screenshot comparisons remain unaccepted. Contact physics, full 3D fidelity and asset-rights review remain pending. No browser pass, deployment or CI pass is claimed. No new media, raw research, captures or production assets are included.
