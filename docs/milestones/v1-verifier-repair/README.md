# V1 milestone: scene verifier repair

This tooling milestone restores complete scene-verification output on the existing application. It adds recursive TS/TSX experience-source aggregation and a passing-check count, plus four regression tests. Every original assertion, expected value, tolerance and failure exit rule is unchanged.

Base commit: `fa5759ecec236cd84d899138174af22357ddce4f`.

## Verification

The exact candidate was checked in an isolated copy on Node 24.19.0:

- `node scripts/verify-scene-params.mjs`: 226/226 checks passed, 0 failed
- `node --test scripts/verify-scene-params.test.mjs`: 4/4 tests passed
- `node --check` for both scripts: passed
- `./node_modules/.bin/tsc --noEmit`: passed
- `npm run lint`: passed with six existing warnings in unchanged production files
- `npm run build`: passed, including generation of 51/51 static pages

The lint warnings are five Next.js image-element warnings in CaseImage, RichInline, RichText and FeaturedWorkGrid (two locations), and one effect-cleanup ref warning in menu-provider. `package.json` has no `test` script; the explicit regression command above is the tested suite.

The regressions check completed output and summary arithmetic, nested TS and TSX rejection by the existing no-`any` guard, and exclusion of non-source/out-of-scope files. Independent review also confirmed original-byte preservation and accurate reporting of multiple failures.

This stage changes no visual source or assets and makes no browser visual-parity claim. Run the commands above from `gladeye-app/`.
