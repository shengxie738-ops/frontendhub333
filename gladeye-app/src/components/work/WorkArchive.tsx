'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

import CaseImage from '@/components/case-study/CaseImage';
import { canUseHover, prefersReducedMotion, Spring, startTicker } from './motion';
import { workAsset } from './data';

import type { ArchiveRow } from '@/content/schema';

/** `ArrowRight` (11 x 10.55) — module 1448, used by the row on small screens. */
function ArrowRight(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 11 10.55" {...props}>
      <path d="M5.5 10.55a.47.47 0 0 1-.35-.15c-.2-.2-.2-.51 0-.71L9.3 5.54H.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5h8.79L5.59.85c-.2-.2-.2-.51 0-.71s.51-.2.71 0l4.55 4.55.01.01s.07.1.1.15c.02.06.04.12.04.19s-.01.14-.04.19c-.02.06-.06.12-.11.16l-5 5c-.1.1-.23.15-.35.15Z" />
    </svg>
  );
}

type Direction = 'down' | 'up';

/**
 * Port of module 4394 (`FeatureList` + `FeatureListItem`, `type:"work"`) from
 * `evidence/source-assets/js/394-2f2be3bc86a0a157.js`, cross-checked against the
 * captured SSR DOM in `evidence/source-pages/_work.html`.
 *
 * The archive is a list of `<a>` rows, and the pointer model is explicit in the
 * shipped bundle (this is NOT an invented hover effect):
 *
 *   window.mousemove -> direction = sign(clientY - lastY)
 *                     -> x.set(clientX - box.width / 2)
 *                     -> y.set(clientY - box.height / 2)      spring: damping 50, stiffness 1000
 *   list mouseenter/leave -> box opacity 1 / 0                transition .25s
 *   row  mouseenter       -> activeIndex = i
 *                     -> box backgroundColor = rows[i].color
 *                     -> rows[i].preview layer opacity = 1
 *                     -> row background scaleY(0 -> 1), transform-origin flips with
 *                        the scroll direction (`down` -> active ? top : bottom)
 *
 * `l.tq` (the bundle's touch/device flag) disables the whole preview; the same gate
 * is expressed here as `@media (hover: hover) and (pointer: fine)`, which is also what
 * every `@media (hover: hover)` rule in the original stylesheet uses.
 */
export function WorkArchive({ rows }: { rows: ArchiveRow[] }) {
  const [active, setActive] = useState<number | null>(null);
  const [hovering, setHovering] = useState(false);
  const [direction, setDirection] = useState<Direction>('down');
  const [mounted, setMounted] = useState(false);

  const boxRef = useRef<HTMLDivElement | null>(null);
  const posX = useRef(new Spring(0, { stiffness: 1000, damping: 50 }));
  const posY = useRef(new Spring(0, { stiffness: 1000, damping: 50 }));
  const stop = useRef<null | (() => void)>(null);
  const lastY = useRef(0);

  const fine = useMemo(() => canUseHover() && !prefersReducedMotion(), []);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!fine) return;
    const onMove = (e: MouseEvent) => {
      if (!boxRef.current) return;
      const { width, height } = boxRef.current.getBoundingClientRect();
      const delta = e.clientY - lastY.current;
      if (delta > 0) setDirection('down');
      else if (delta < 0) setDirection('up');
      lastY.current = e.clientY;
      posX.current.set(e.clientX - width / 2);
      posY.current.set(e.clientY - height / 2);
      if (!stop.current) {
        stop.current = startTicker((dt) => {
          const el = boxRef.current;
          if (!el) return false;
          posX.current.step(dt);
          posY.current.step(dt);
          el.style.transform = `translate3d(${posX.current.value}px, ${posY.current.value}px, 0) translateZ(0)`;
          if (posX.current.done && posY.current.done) {
            stop.current = null;
            return false;
          }
          return true;
        });
      }
    };
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      stop.current?.();
      stop.current = null;
    };
  }, [fine]);

  const origin = (i: number): 'top' | 'bottom' => {
    const isActive = active === i;
    if (direction === 'down') return isActive ? 'top' : 'bottom';
    return isActive ? 'bottom' : 'top';
  };

  return (
    <div className="FeatureList_main__OqQMF">
      <div
        className="FeatureList_inner__UOo8l"
        onMouseMove={() => fine && setHovering(true)}
        onMouseLeave={() => {
          if (!fine) return;
          setHovering(false);
          setActive(null);
        }}
      >
        {fine ? (
          <div
            ref={boxRef}
            className="FeatureList_box__XzHZx"
            style={{
              opacity: hovering ? 1 : 0,
              backgroundColor: active !== null ? rows[active].color || '' : '',
              transition: 'opacity .25s cubic-bezier(0.165, 0.84, 0.44, 1)',
              transform: 'none',
            }}
            aria-hidden
          >
            {rows.map((row, i) => (
              <div
                key={row.slug}
                className="absolute inset-0 h-full w-full overflow-hidden"
                style={{
                  opacity: active === i ? 1 : 0,
                  transition: 'opacity .25s cubic-bezier(0.165, 0.84, 0.44, 1)',
                }}
              >
                {/* the original passes the whole CMS colour object here, which paints
                    `background:[object Object]` and therefore nothing — kept transparent */}
                <div className="h-full w-full">
                  <div className="h-full w-full" style={{ opacity: 1 }}>
                    <CaseImage asset={row.preview} src={workAsset(row.slug, row.preview) ?? ''} sizes="25vw" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {rows.map((row, i) => (
          <Link
            key={row.slug}
            href={`/work/${row.slug}`}
            scroll={false}
            className={`FeatureList_item__3Uvy5 FeatureList_interactive__vocFb ${active === i ? 'FeatureList_active__RP_d2' : ''}`}
            style={{
              opacity: mounted ? 1 : 0,
              transition: `opacity .5s cubic-bezier(0.165, 0.84, 0.44, 1) ${Math.min(i, 40) * 0.025}s`,
            }}
            onMouseEnter={() => setActive(i)}
          >
            <div className="FeatureList_item-inner__rl_Xr">
              <div className="FeatureList_item-border-top__VoQoY" />
              <div className="col-span-3 hidden sm:block lg:col-span-4">
                <h3 className="t-list-sm">{row.year}</h3>
              </div>
              <div className="col-span-10 sm:col-span-5 lg:col-span-12">
                <h4 className="t-h5">{row.title}</h4>
              </div>
              <div className="col-span-2 flex items-center justify-end gap-x-sgs sm:col-span-4 lg:col-span-8 lg:justify-between">
                <h5 className="t-list hidden lg:block">{row.client}</h5>
                <div className="hidden flex-shrink-0 sm:inline-flex">
                  <div className="Button_main__NewW7 Button_small__pgXYR Button_ghost__gZqlA pointer-events-none">
                    <span className="Button_inner__d7ZPg">{row.viewLabel || 'View project'}</span>
                  </div>
                </div>
                <div className="px-s-1.5 sm:hidden">
                  <ArrowRight className="h-s-4 w-s-4 fill-current" />
                </div>
              </div>
              <div className="FeatureList_item-border-bottom__Ar4na" />
              <div
                className="FeatureList_item-background__nqt3P"
                style={{
                  background: row.color,
                  ['--transform-origin' as string]: origin(i),
                  transform: active === i && fine ? 'scaleY(1) translateZ(0)' : 'scaleY(0) translateZ(0)',
                  transition: 'transform .25s cubic-bezier(0.165, 0.84, 0.44, 1)',
                }}
              />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default WorkArchive;
