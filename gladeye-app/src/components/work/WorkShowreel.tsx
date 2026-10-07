'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { canUseHover, prefersReducedMotion, Spring, startTicker } from './motion';
import { projects } from './data';

/** Play (15x17) / pause (10x17) glyphs, verbatim from module 1959 of the /work chunk. */
function PlayIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={15} height={17} fill="none" {...props}>
      <path stroke="#FCF9F9" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M1 16V1l12.5 7.5L1 16Z" />
    </svg>
  );
}
function PauseIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={10} height={17} fill="none" {...props}>
      <path stroke="#FCF9F9" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M1 1v15M9 1v15" />
    </svg>
  );
}

/**
 * Port of module 1959 `Video3d` (`B`) — the showreel block on /work.
 *
 * Read straight off the shipped bundle + the captured SSR DOM:
 *   wrapper onMouseMove  -> cursor on          (touch never enables it)
 *   wrapper onMouseLeave -> cursor off
 *   wrapper onClick      -> hasPlayed = true, playing = !playing
 *   playHint             -> visible while !playing && !hasPlayed  (`Video3d_showPlayHint`)
 *   player               -> react-player on vimeo 879597010, looped, playsInline
 *   fadeToMute           -> gsap tween of player.setVolume(0|1) over 1s when the
 *                           section leaves / enters the middle of the viewport
 *
 * The volume tween is reproduced with Vimeo's documented `postMessage` control channel
 * (`{method:'setVolume'}`) instead of the gsap + react-player refs, so no extra
 * dependency is pulled in. Everything else — including `controls=0`, which is why the
 * whole block is a click target rather than a native player — is the original's.
 */
export function WorkShowreel({ fadeToMute = false }: { fadeToMute?: boolean }) {
  const { vimeoId, embedUrl, playLabel, title } = projects.showreel;
  const [hovering, setHovering] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [pointerLive, setPointerLive] = useState(false);

  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const posX = useRef(new Spring(-50, { stiffness: 1000, damping: 100 }));
  const posY = useRef(new Spring(-50, { stiffness: 1000, damping: 100 }));
  const stop = useRef<null | (() => void)>(null);

  const fine = useMemo(() => canUseHover() && !prefersReducedMotion(), []);

  useEffect(() => {
    if (!fine) return;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        setPointerLive(false);
        return;
      }
      setPointerLive(true);
      posX.current.set(e.clientX);
      posY.current.set(e.clientY);
      if (!stop.current) {
        stop.current = startTicker((dt) => {
          const el = cursorRef.current;
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
    window.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('pointermove', onMove);
      stop.current?.();
      stop.current = null;
    };
  }, [fine]);

  useEffect(() => {
    const win = frameRef.current?.contentWindow;
    if (!win) return;
    const value = fadeToMute ? 0 : 1;
    try {
      win.postMessage(JSON.stringify({ method: 'setVolume', value }), 'https://player.vimeo.com');
    } catch {
      /* the iframe may not be ready yet; the volume only matters once it is */
    }
  }, [fadeToMute, playing]);

  const src = `${embedUrl}${embedUrl.includes('?') ? '&' : '?'}autoplay=1`;

  return (
    <div
      className="Video3d_wrapper__Xb_F2"
      onMouseMove={() => !hovering && setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onClick={() => {
        setHasPlayed(true);
        setPlaying((p) => !p);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setHasPlayed(true);
          setPlaying((p) => !p);
        }
      }}
      aria-label={`${playLabel} showreel`}
      aria-pressed={playing}
    >
      <div
        ref={cursorRef}
        className="ColoredDotCursor_custom-cursor__QMy_f Video3d_custom-cursor__4aN6W"
        style={{
          opacity: hovering && pointerLive && fine ? 1 : 0,
          transition: 'opacity .25s cubic-bezier(0.165, 0.84, 0.44, 1)',
        }}
        aria-hidden
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </div>

      <div className={`Video3d_playHint__krlbd ${!playing && !hasPlayed ? 'Video3d_showPlayHint__xD6v6' : ''}`.trim()}>
        <div className="Video3d_playIcon__qm_t1">
          <PlayIcon />
        </div>
        <span className="Video3d_playText__RjK7U">{playLabel}</span>
      </div>

      <p className="Video3d_playerTitle__weYah">{title}</p>

      <div className="Video3d_playerWrapper__wpK_D">
        <div style={{ width: '100%', height: '100%' }} className="Video3d_reactPlayer__Zx2X6">
          {hasPlayed ? (
            <iframe
              ref={frameRef}
              title="Gladeye showreel"
              src={src}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default WorkShowreel;
