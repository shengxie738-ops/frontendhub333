# Safe header/menu component regressions

From `gladeye-app`:

```sh
npm ci --legacy-peer-deps --ignore-scripts
npm run test:header-menu
```

Tested with Node.js 24.19.0 and npm 11.9.0. jsdom is an app-local pinned devDependency (`30.0.1`); use a Node version compatible with its locked engine requirements. There is no external workspace module path, environment override, browser installation or running development server requirement.

The legacy-peer option preserves this repository's existing peer-dependency graph. With the tested npm version, both the original pre-jsdom lockfile and this candidate reject default `npm ci` because two pre-existing @emnapi peer entries are absent. No unrelated peer packages or version upgrades were added to hide that issue.

The explicit script executes only `scripts/header-menu.test.cjs`. It does not discover the legacy browser scripts, require unsafe renderer flags, launch a browser or reference Contact's independent/uncommitted test files. Avoid broad `node --test` discovery in this repository: existing browser scripts have separate authorization requirements.

The harness mounts real React 18/ReactDOM, ThemeProvider, MenuProvider, RouteThemeSync, SiteHeader, MenuOverlay, Button and the production scroll-lock module. Real RouteThemeSync is enabled by default. One clearly named isolated pathname-invalidation test intentionally excludes it to exercise the overlay's own cancellation responsibility. Next's routing interface and unrelated flower/icon/footer visuals are substitutes; real browser routing and visuals are separately gated.

Coverage includes ref/ARIA forwarding, native-focus preservation, intentional close-focus return, inert exit navigation, interrupted/reopened/unmounted timers, same-route section-theme restoration, section updates during an open menu, new-route theme ownership, exact menu destinations/Work selection, nested scroll-lock owners and StrictMode repeated cycles. Timers are deterministic; native Tab progression, CSS motion, geometry, wheel scrolling and actual Next routing still need authorized browser QA.
