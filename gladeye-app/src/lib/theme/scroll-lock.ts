/**
 * Reference-counted page scroll lock with explicit owner tokens.
 *
 * The original bundles `scroll-lock@2` (webpack module 4346) whose API is
 * `disablePageScroll(target)` / `enablePageScroll(target)` over an internal
 * queue. This module keeps the same *behaviour* but replaces the implicit queue
 * with a named-owner map so that:
 *
 *   • several overlays can hold the lock at once (`acquire('menu')` +
 *     `acquire('lightbox')`); releasing one MUST NOT unlock the others;
 *   • the document scroll position captured by the FIRST acquirer is the one
 *     restored when the LAST owner releases;
 *   • a locked *container* (an overlay's own scroll element) has its original
 *     `scrollTop` snapshotted on acquire and restored on release.
 *
 * All functions are no-ops on the server, so the module is import-safe from
 * server components.
 */

export type ScrollLockOwner = string;

export type FillGapMethod = "padding" | "margin" | "width" | "scrollbar";

export interface AcquireOptions {
  /** Element that should stay scrollable while the page is locked. */
  target?: HTMLElement | null;
  /** How the removed scrollbar gap is compensated. Defaults to `padding`. */
  fillGapMethod?: FillGapMethod;
}

interface OwnerRecord {
  target: HTMLElement | null;
  targetScrollTop: number;
}

interface Baseline {
  htmlOverflow: string;
  htmlPaddingRight: string;
  htmlMarginRight: string;
  htmlWidth: string;
  bodyPosition: string;
  bodyTop: string;
  bodyLeft: string;
  bodyRight: string;
  bodyWidth: string;
  bodyPaddingRight: string;
  bodyMarginRight: string;
  fillGapNodes: Array<{ el: HTMLElement; paddingRight: string }>;
}

const owners = new Map<ScrollLockOwner, OwnerRecord>();

let documentScrollTop = 0;
let baseline: Baseline | null = null;
const isBrowser = (): boolean =>
  typeof document !== "undefined" && typeof window !== "undefined";

function readDocumentScrollTop(): number {
  return (
    window.pageYOffset ||
    document.documentElement.scrollTop ||
    (document.body ? document.body.scrollTop : 0) ||
    0
  );
}

function getScrollbarWidth(): number {
  return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
}

function px(value: string): number {
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function captureBaseline(method: FillGapMethod): Baseline {
  const html = document.documentElement;
  const body = document.body;
  const selector = "[data-scroll-lock-fill-gap]";
  return {
    htmlOverflow: html.style.overflow,
    htmlPaddingRight: html.style.paddingRight,
    htmlMarginRight: html.style.marginRight,
    htmlWidth: html.style.width,
    bodyPosition: body ? body.style.position : "",
    bodyTop: body ? body.style.top : "",
    bodyLeft: body ? body.style.left : "",
    bodyRight: body ? body.style.right : "",
    bodyWidth: body ? body.style.width : "",
    bodyPaddingRight: body ? body.style.paddingRight : "",
    bodyMarginRight: body ? body.style.marginRight : "",
    fillGapNodes:
      method === "scrollbar"
        ? []
        : Array.from(document.querySelectorAll<HTMLElement>(selector)).map((el) => ({
            el,
            paddingRight: el.style.paddingRight,
          })),
  };
}

function applyLock(method: FillGapMethod): void {
  const html = document.documentElement;
  const body = document.body;
  const gapWidth = getScrollbarWidth();

  html.style.overflow = "hidden";

  if (gapWidth > 0 && body) {
    if (method === "padding") {
      html.style.paddingRight = `${px(getComputedStyle(html).paddingRight) + gapWidth}px`;
      body.style.paddingRight = `${px(getComputedStyle(body).paddingRight) + gapWidth}px`;
    } else if (method === "margin") {
      html.style.marginRight = `${px(getComputedStyle(html).marginRight) + gapWidth}px`;
      body.style.marginRight = `${px(getComputedStyle(body).marginRight) + gapWidth}px`;
    } else if (method === "width") {
      html.style.width = `${window.innerWidth - gapWidth}px`;
    }
  }

  if (body && method !== "scrollbar") {
    for (const node of baseline?.fillGapNodes ?? []) {
      node.el.style.paddingRight = `${
        px(getComputedStyle(node.el).paddingRight) + gapWidth
      }px`;
    }
  }

  // `html{overflow:hidden}` alone only removes the scrollbar and user
  // scrolling — programmatic window.scrollTo() still moves the page, so the
  // freeze is incomplete. The body is pinned instead, which also preserves the
  // offset. This requires the fixed header to declare its own `top` (see
  // SiteHeader): a `fixed` element with no `top` takes its used value from its
  // static position, which is exactly what shifting the body moves.
  if (body) {
    body.style.position = "fixed";
    body.style.top = `-${documentScrollTop}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
  }
}

function releaseLock(from: Baseline): void {
  const html = document.documentElement;
  const body = document.body;

  html.style.overflow = from.htmlOverflow;
  html.style.paddingRight = from.htmlPaddingRight;
  html.style.marginRight = from.htmlMarginRight;
  html.style.width = from.htmlWidth;

  if (body) {
    body.style.position = from.bodyPosition;
    body.style.top = from.bodyTop;
    body.style.left = from.bodyLeft;
    body.style.right = from.bodyRight;
    body.style.width = from.bodyWidth;
    body.style.paddingRight = from.bodyPaddingRight;
    body.style.marginRight = from.bodyMarginRight;
  }

  for (const node of from.fillGapNodes) {
    node.el.style.paddingRight = node.paddingRight;
  }
}

/**
 * Lock page scrolling for `owner`. Calling it twice with the same token just
 * refreshes that token's record; it never double-counts.
 */
export function acquireScrollLock(
  owner: ScrollLockOwner,
  options: AcquireOptions = {},
): void {
  if (!isBrowser()) return;

  const { target = null, fillGapMethod = "padding" } = options;

  if (owners.has(owner)) {
    owners.set(owner, {
      target,
      targetScrollTop: target ? target.scrollTop : (owners.get(owner)?.targetScrollTop ?? 0),
    });
    return;
  }

  if (owners.size === 0) {
    documentScrollTop = readDocumentScrollTop();
    baseline = captureBaseline(fillGapMethod);
  }

  owners.set(owner, { target, targetScrollTop: target ? target.scrollTop : 0 });

  if (owners.size === 1 && baseline) {
    applyLock(fillGapMethod);
  }

  if (target) target.dataset.scrollLockOwner = owner;
}

/** Release the lock held by `owner`. Remaining owners keep the page locked. */
export function releaseScrollLock(owner: ScrollLockOwner): void {
  if (!isBrowser()) return;

  const record = owners.get(owner);
  if (!record) return;

  owners.delete(owner);

  if (record.target) {
    record.target.scrollTop = record.targetScrollTop;
    delete record.target.dataset.scrollLockOwner;
  }

  if (owners.size > 0) return;

  // Last owner out: undo the lock and restore the pre-lock document scrollY.
  if (baseline) releaseLock(baseline);
  baseline = null;
  window.scrollTo(0, documentScrollTop);
  documentScrollTop = 0;
}

export function isScrollLocked(): boolean {
  return owners.size > 0;
}

export function scrollLockOwnerCount(): number {
  return owners.size;
}

export function scrollLockOwners(): ScrollLockOwner[] {
  return Array.from(owners.keys());
}

/** The document scrollY frozen by the current lock (0 when unlocked). */
export function scrollLockSavedScrollY(): number {
  return documentScrollTop;
}

/** Escape hatch for tests and hard route resets. */
export function forceReleaseAllScrollLocks(): void {
  for (const owner of Array.from(owners.keys())) releaseScrollLock(owner);
}
