/**
 * Icon set for the info pages. All paths are copied verbatim from
 * `evidence/content/_about.svgs.json` / `_careers.svgs.json` — the original
 * `viewBox` and `d` values, not a similar-looking replacement.
 */

/** Diagonal "external" arrow, `viewBox="0 0 17.57 17.57"`. */
export function ArrowUpRightIcon({ className }: { className?: string }) {
  return (
    <svg viewBox='0 0 17.57 17.57' className={className ?? 'fill-current'} aria-hidden='true'>
      <path d='M1.03 17.57c-.26 0-.53-.1-.73-.3-.4-.4-.4-1.06 0-1.46L14.04 2.07H1.03C.46 2.07 0 1.6 0 1.03S.46 0 1.03 0h15.53c.13 0 .25.03.36.08.12.05.23.12.33.22a1.04 1.04 0 0 1 .29.72v14.14c0 .57-.46 1.03-1.03 1.03s-1.03-.46-1.03-1.03V3.53L1.76 17.26c-.2.2-.47.3-.73.3Z' />
    </svg>
  );
}

/** Small right arrow, `viewBox="0 0 11 10.55"` — careers row chevron / form submit. */
export function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg viewBox='0 0 11 10.55' className={className ?? 'h-s-4 w-s-4 fill-current'} aria-hidden='true'>
      <path d='M5.5 10.55a.47.47 0 0 1-.35-.15c-.2-.2-.2-.51 0-.71L9.3 5.54H.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5h8.79L5.59.85c-.2-.2-.2-.51 0-.71s.51-.2.71 0l4.55 4.55.01.01s.07.1.1.15c.02.06.04.12.04.19s-.01.14-.04.19c-.02.06-.06.12-.11.16l-5 5c-.1.1-.23.15-.35.15Z' />
    </svg>
  );
}
